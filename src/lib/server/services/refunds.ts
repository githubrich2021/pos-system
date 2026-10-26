import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { can } from '../../core/permissions';
import { DECIMAL_UNITS, lineRefund, roundQty } from '../../core/pricing';
import { customerBalances } from './customers';
import { getOpenShift } from './sales';

type Auth = NonNullable<App.Locals['auth']>;
type Exec = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class RefundError extends Error {
	constructor(message: string, public status = 400) {
		super(message);
	}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REFUND_METHODS = {
	cash: 'Cash',
	momo: 'Mobile money',
	card: 'Card',
	bank: 'Bank transfer',
	account: 'Taken off what they owe'
} as const;
export type RefundMethod = keyof typeof REFUND_METHODS;

export interface RefundInput {
	/** UUID made in the browser, so a double submit refunds once. */
	id: string;
	lines: { saleItemId: string; quantity: number; restock: boolean }[];
	method: string;
	reference?: string;
	reason: string;
}

/** What has already been refunded on each line of a sale. */
async function refundedSoFar(exec: Exec, saleId: string) {
	const rows = await exec
		.select({
			saleItemId: schema.refundItems.saleItemId,
			quantity: sql<number>`sum(${schema.refundItems.quantity})`.mapWith(Number),
			amount: sql<number>`sum(${schema.refundItems.amount})`.mapWith(Number),
			tax: sql<number>`sum(${schema.refundItems.tax})`.mapWith(Number)
		})
		.from(schema.refundItems)
		.innerJoin(schema.refunds, eq(schema.refunds.id, schema.refundItems.refundId))
		.where(eq(schema.refunds.saleId, saleId))
		.groupBy(schema.refundItems.saleItemId);
	return new Map(rows.map((r) => [r.saleItemId, { ...r, quantity: roundQty(r.quantity) }]));
}

/**
 * Lines of a sale with how much is left to refund, for the refund form.
 * Also says how much money can still be paid out (vs. only taken off the customer's account).
 */
export async function refundableLines(exec: Exec, saleId: string) {
	const [items, done, paid, refunded] = await Promise.all([
		exec
			.select({ item: schema.saleItems, unit: schema.products.unit })
			.from(schema.saleItems)
			.leftJoin(schema.products, eq(schema.products.id, schema.saleItems.productId))
			.where(eq(schema.saleItems.saleId, saleId))
			.orderBy(asc(schema.saleItems.name)),
		refundedSoFar(exec, saleId),
		exec
			.select({
				// Money actually taken (not "pay later")
				cash: sql<number>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.method} <> 'credit'), 0)`.mapWith(Number),
				credit: sql<number>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.method} = 'credit'), 0)`.mapWith(Number)
			})
			.from(schema.payments)
			.where(and(eq(schema.payments.saleId, saleId), eq(schema.payments.status, 'paid'))),
		exec
			.select({
				paidOut: sql<number>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.method} <> 'account'), 0)`.mapWith(Number),
				total: sql<number>`coalesce(sum(${schema.refunds.amount}), 0)`.mapWith(Number)
			})
			.from(schema.refunds)
			.where(eq(schema.refunds.saleId, saleId))
	]);

	const lines = items.map(({ item, unit }) => {
		const prev = done.get(item.id);
		const refundedQty = prev?.quantity ?? 0;
		return {
			saleItemId: item.id,
			productId: item.productId,
			name: item.name,
			unit: unit ?? 'pcs',
			// Weighed items can be part-refunded (0.5 kg); others in whole units
			decimal: unit ? DECIMAL_UNITS.has(unit) : !Number.isInteger(item.quantity),
			sold: item.quantity,
			refundedQty,
			remaining: roundQty(item.quantity - refundedQty),
			lineTotal: item.lineTotal,
			tax: item.tax,
			refundedAmount: prev?.amount ?? 0,
			refundedTax: prev?.tax ?? 0
		};
	});
	return {
		lines,
		/** Most money that can still be handed back in cash/MoMo/card/bank. */
		payableLeft: Math.max(0, paid[0].cash - refunded[0].paidOut),
		creditOnSale: paid[0].credit,
		refundedTotal: refunded[0].total
	};
}

export async function createRefund(auth: Auth, saleId: string, input: RefundInput) {
	if (!can(auth.permissions, 'sales.refund')) throw new RefundError('Only a manager can give refunds.', 403);
	if (!UUID.test(saleId)) throw new RefundError('Sale not found.', 404);
	if (!input || !UUID.test(input.id ?? '')) throw new RefundError('Invalid refund ID.');

	const [existing] = await db
		.select({ id: schema.refunds.id, tenantId: schema.refunds.tenantId })
		.from(schema.refunds)
		.where(eq(schema.refunds.id, input.id));
	if (existing) {
		if (existing.tenantId !== auth.tenantId) throw new RefundError('Invalid refund ID.');
		return { id: existing.id, duplicate: true };
	}

	if (!(input.method in REFUND_METHODS)) throw new RefundError('Choose how the money goes back.');
	const method = input.method as RefundMethod;
	const reason = input.reason?.trim().slice(0, 300);
	if (!reason) throw new RefundError('Give a reason for the refund.');
	if (!Array.isArray(input.lines) || input.lines.length === 0) throw new RefundError('Choose what is being returned.');

	const shift = await getOpenShift(auth);
	if (method === 'cash' && !shift) throw new RefundError('Open a shift first, so the cash taken from the drawer is recorded.', 409);

	return db.transaction(async (tx) => {
		const [sale] = await tx
			.select()
			.from(schema.sales)
			.where(and(eq(schema.sales.id, saleId), eq(schema.sales.tenantId, auth.tenantId)))
			.for('update');
		if (!sale) throw new RefundError('Sale not found.', 404);
		if (sale.status === 'voided') throw new RefundError('This sale was voided, so there is nothing to refund.');
		if (sale.status === 'refunded') throw new RefundError('This sale has already been fully refunded.');
		if (sale.status !== 'completed' && sale.status !== 'partially_refunded') throw new RefundError('This sale cannot be refunded.');

		const state = await refundableLines(tx, saleId);
		const byId = new Map(state.lines.map((l) => [l.saleItemId, l]));
		const seen = new Set<string>();

		const picked: { line: (typeof state.lines)[number]; qty: number; restock: boolean; amount: number; tax: number }[] = [];
		for (const l of input.lines) {
			const line = byId.get(l?.saleItemId);
			if (!line) throw new RefundError('An item is not on this sale.');
			if (seen.has(line.saleItemId)) throw new RefundError(`${line.name} is listed twice.`);
			seen.add(line.saleItemId);
			const qty = roundQty(Number(l.quantity));
			if (!Number.isFinite(qty) || qty < 0) throw new RefundError(`Enter a valid quantity for ${line.name}.`);
			if (qty === 0) continue;
			if (!line.decimal && !Number.isInteger(qty)) throw new RefundError(`${line.name} is refunded in whole ${line.unit}.`);
			if (qty > line.remaining) {
				throw new RefundError(
					line.remaining === 0
						? `${line.name} has already been refunded.`
						: `Only ${line.remaining} ${line.unit} of ${line.name} can still be refunded.`
				);
			}
			picked.push({ line, qty, restock: !!l.restock, ...lineRefund(line, qty) });
		}
		if (picked.length === 0) throw new RefundError('Enter how many of each item is being returned.');

		const amount = picked.reduce((a, p) => a + p.amount, 0);
		const tax = picked.reduce((a, p) => a + p.tax, 0);

		// Never hand back more money than the sale took in
		if (method !== 'account' && amount > state.payableLeft) {
			throw new RefundError(
				state.creditOnSale > 0
					? `Only ${(state.payableLeft / 100).toFixed(2)} ${auth.currency} of this sale was paid. Take the rest off what the customer owes.`
					: `Only ${(state.payableLeft / 100).toFixed(2)} ${auth.currency} can still be refunded on this sale.`
			);
		}
		if (method === 'account') {
			if (!sale.customerId) throw new RefundError('This sale has no customer, so pay the money back instead.');
			const [customer] = await tx.select().from(schema.customers).where(eq(schema.customers.id, sale.customerId)).for('update');
			const owed = (await customerBalances(tx, auth.tenantId, [sale.customerId])).get(sale.customerId) ?? 0;
			if (amount > owed) {
				throw new RefundError(`${customer?.name ?? 'The customer'} only owes ${(Math.max(owed, 0) / 100).toFixed(2)} ${auth.currency}. Pay the rest back another way.`);
			}
		}

		await tx.insert(schema.refunds).values({
			id: input.id,
			tenantId: auth.tenantId,
			branchId: sale.branchId,
			saleId,
			shiftId: shift?.id ?? null,
			userId: auth.userId,
			method,
			amount,
			tax,
			reference: input.reference?.trim().slice(0, 100) || null,
			reason
		});
		await tx.insert(schema.refundItems).values(
			picked.map((p) => ({
				tenantId: auth.tenantId,
				refundId: input.id,
				saleItemId: p.line.saleItemId,
				productId: p.line.productId,
				name: p.line.name,
				quantity: p.qty,
				amount: p.amount,
				tax: p.tax,
				restocked: p.restock && !!p.line.productId
			}))
		);

		// Returned items go back on the shelf unless they were damaged
		const restock = picked.filter((p) => p.restock && p.line.productId);
		if (restock.length) {
			const tracked = await tx
				.select({ id: schema.products.id })
				.from(schema.products)
				.where(and(inArray(schema.products.id, restock.map((p) => p.line.productId!)), eq(schema.products.trackStock, true)));
			const trackedIds = new Set(tracked.map((t) => t.id));
			const movements = restock
				.filter((p) => trackedIds.has(p.line.productId!))
				.map((p) => ({
					tenantId: auth.tenantId,
					branchId: sale.branchId,
					productId: p.line.productId!,
					quantity: p.qty,
					reason: 'refund' as const,
					refId: saleId,
					note: `Refund on ${sale.receiptNo}`,
					userId: auth.userId
				}));
			if (movements.length) await tx.insert(schema.stockMovements).values(movements);
		}

		const allBack = state.lines.every((l) => {
			const p = picked.find((x) => x.line.saleItemId === l.saleItemId);
			return roundQty(l.remaining - (p?.qty ?? 0)) === 0;
		});
		await tx
			.update(schema.sales)
			.set({ status: allBack ? 'refunded' : 'partially_refunded' })
			.where(eq(schema.sales.id, saleId));

		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'sale.refunded',
			entity: 'sale',
			entityId: saleId,
			details: {
				refundId: input.id,
				receiptNo: sale.receiptNo,
				amount,
				method,
				reason,
				items: picked.map((p) => ({ name: p.line.name, quantity: p.qty, restocked: p.restock }))
			}
		});

		return { id: input.id, duplicate: false, amount, fullyRefunded: allBack };
	});
}

/** Refunds on one sale, newest first, with their items. */
export async function refundsForSale(auth: Auth, saleId: string) {
	const rows = await db
		.select({ refund: schema.refunds, by: schema.users.name })
		.from(schema.refunds)
		.leftJoin(schema.users, eq(schema.users.id, schema.refunds.userId))
		.where(and(eq(schema.refunds.saleId, saleId), eq(schema.refunds.tenantId, auth.tenantId)))
		.orderBy(sql`${schema.refunds.createdAt} desc`);
	if (rows.length === 0) return [];
	const items = await db
		.select()
		.from(schema.refundItems)
		.where(inArray(schema.refundItems.refundId, rows.map((r) => r.refund.id)));
	return rows.map((r) => ({ ...r.refund, by: r.by, items: items.filter((i) => i.refundId === r.refund.id) }));
}

/** One refund with its sale and business, for the printed refund slip. */
export async function getRefund(auth: Auth, refundId: string) {
	if (!UUID.test(refundId)) return null;
	const [row] = await db
		.select({
			refund: schema.refunds,
			receiptNo: schema.sales.receiptNo,
			saleUserId: schema.sales.userId,
			customer: schema.customers.name,
			by: schema.users.name,
			tenant: schema.tenants
		})
		.from(schema.refunds)
		.innerJoin(schema.sales, eq(schema.sales.id, schema.refunds.saleId))
		.innerJoin(schema.tenants, eq(schema.tenants.id, schema.refunds.tenantId))
		.leftJoin(schema.customers, eq(schema.customers.id, schema.sales.customerId))
		.leftJoin(schema.users, eq(schema.users.id, schema.refunds.userId))
		.where(and(eq(schema.refunds.id, refundId), eq(schema.refunds.tenantId, auth.tenantId)));
	if (!row) return null;
	const items = await db.select().from(schema.refundItems).where(eq(schema.refundItems.refundId, refundId));
	return { ...row, items };
}
