import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '../db';
import { calculateSale, roundQty, DECIMAL_UNITS, settlePayments, PAYMENT_METHODS, type PaymentMethod } from '../../core/pricing';
import { can } from '../../core/permissions';

type Auth = NonNullable<App.Locals['auth']>;
type Device = App.Locals['device'];

export class SaleError extends Error {
	constructor(message: string, public status = 400) {
		super(message);
	}
}

export interface SaleInput {
	/** UUID made on the till. Sending the same sale twice (double click, retry, offline sync) saves it once. */
	id: string;
	lines: { productId: string; quantity: number }[];
	discount: number;
	payments: { method: string; amount: number; reference?: string }[];
	note?: string;
	soldAt?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOpenShift(auth: Auth) {
	const [shift] = await db
		.select()
		.from(schema.shifts)
		.where(
			and(
				eq(schema.shifts.tenantId, auth.tenantId),
				eq(schema.shifts.userId, auth.userId),
				isNull(schema.shifts.closedAt)
			)
		)
		.limit(1);
	return shift ?? null;
}

/**
 * Saves a completed sale. Prices, tax and totals are recalculated from the database;
 * the till only says which products, how many, the discount and how it was paid.
 */
export async function createSale(auth: Auth, device: Device, input: SaleInput) {
	if (!can(auth.permissions, 'sales.create')) throw new SaleError('You are not allowed to make sales.', 403);
	if (!input || !UUID.test(input.id ?? '')) throw new SaleError('Invalid sale ID.');

	// Already saved (double click or retry)? Return it unchanged.
	const [existing] = await db
		.select({ id: schema.sales.id, receiptNo: schema.sales.receiptNo, tenantId: schema.sales.tenantId })
		.from(schema.sales)
		.where(eq(schema.sales.id, input.id));
	if (existing) {
		if (existing.tenantId !== auth.tenantId) throw new SaleError('Invalid sale ID.');
		return { id: existing.id, receiptNo: existing.receiptNo, duplicate: true };
	}

	if (!Array.isArray(input.lines) || input.lines.length === 0) throw new SaleError('The cart is empty.');
	if (input.lines.length > 500) throw new SaleError('Too many lines in one sale.');

	const shift = await getOpenShift(auth);
	if (!shift) throw new SaleError('Open a shift before selling.', 409);

	// Merge duplicate products and load their current prices
	const qtyByProduct = new Map<string, number>();
	for (const line of input.lines) {
		if (!UUID.test(line?.productId ?? '')) throw new SaleError('Invalid product in cart.');
		const q = Number(line.quantity);
		if (!Number.isFinite(q) || q <= 0 || q > 100000) throw new SaleError('Invalid quantity in cart.');
		qtyByProduct.set(line.productId, roundQty((qtyByProduct.get(line.productId) ?? 0) + q));
	}

	const rows = await db
		.select({ product: schema.products, tax: schema.taxRates })
		.from(schema.products)
		.leftJoin(schema.taxRates, eq(schema.taxRates.id, schema.products.taxRateId))
		.where(and(eq(schema.products.tenantId, auth.tenantId), inArray(schema.products.id, [...qtyByProduct.keys()])));

	if (rows.length !== qtyByProduct.size) throw new SaleError('Some products in the cart no longer exist.');
	const inactive = rows.find((r) => !r.product.isActive);
	if (inactive) throw new SaleError(`${inactive.product.name} is no longer for sale.`);

	const items = rows.map(({ product, tax }) => {
		const quantity = qtyByProduct.get(product.id)!;
		if (!Number.isInteger(quantity) && !DECIMAL_UNITS.has(product.unit)) {
			throw new SaleError(`${product.name} is sold in whole ${product.unit}.`);
		}
		const active = tax?.isActive ? tax : null;
		return { product, quantity, taxRateBp: active?.rateBp ?? null, taxInclusive: active?.inclusive ?? true };
	});

	const discount = Math.round(Number(input.discount) || 0);
	if (discount < 0) throw new SaleError('Discount cannot be negative.');
	if (discount > 0 && !can(auth.permissions, 'sales.discount')) throw new SaleError('You are not allowed to give discounts.', 403);

	const totals = calculateSale(
		items.map((i) => ({ unitPrice: i.product.sellPrice, quantity: i.quantity, taxRateBp: i.taxRateBp, taxInclusive: i.taxInclusive })),
		discount
	);
	if (discount > totals.subtotal) throw new SaleError('Discount is more than the sale.');

	const payments = (input.payments ?? []).map((p) => {
		if (!(p?.method in PAYMENT_METHODS)) throw new SaleError('Unknown payment method.');
		return {
			method: p.method as PaymentMethod,
			amount: Math.round(Number(p.amount)),
			reference: p.reference ? String(p.reference).slice(0, 100) : undefined
		};
	});
	if (payments.length === 0 || payments.length > 10) throw new SaleError('Add a payment.');
	const settled = settlePayments(totals.total, payments);
	if (settled.error) throw new SaleError(settled.error);

	const soldAt = input.soldAt ? new Date(input.soldAt) : new Date();
	if (Number.isNaN(soldAt.getTime()) || soldAt.getTime() > Date.now() + 5 * 60 * 1000) throw new SaleError('Invalid sale time.');

	return db.transaction(async (tx) => {
		// Next receipt number: per till, or per business for unregistered browsers
		let receiptNo: string;
		if (device && device.tenantId === auth.tenantId) {
			const [d] = await tx
				.update(schema.devices)
				.set({ receiptCounter: sql`${schema.devices.receiptCounter} + 1`, lastSeenAt: new Date() })
				.where(eq(schema.devices.id, device.id))
				.returning({ n: schema.devices.receiptCounter, code: schema.devices.code });
			receiptNo = `${d.code}-${String(d.n).padStart(6, '0')}`;
		} else {
			const [t] = await tx
				.update(schema.tenants)
				.set({ receiptCounter: sql`${schema.tenants.receiptCounter} + 1` })
				.where(eq(schema.tenants.id, auth.tenantId))
				.returning({ n: schema.tenants.receiptCounter });
			receiptNo = `W-${String(t.n).padStart(6, '0')}`;
		}

		await tx.insert(schema.sales).values({
			id: input.id,
			tenantId: auth.tenantId,
			branchId: auth.branchId,
			deviceId: device?.tenantId === auth.tenantId ? device.id : null,
			shiftId: shift.id,
			userId: auth.userId,
			receiptNo,
			status: 'completed',
			source: 'retail',
			subtotal: totals.subtotal,
			discountTotal: totals.discountTotal,
			taxTotal: totals.taxTotal,
			total: totals.total,
			cashTendered: settled.cashTendered,
			changeGiven: settled.change,
			note: input.note?.slice(0, 500) || null,
			soldAt
		});

		await tx.insert(schema.saleItems).values(
			items.map((item, i) => ({
				tenantId: auth.tenantId,
				saleId: input.id,
				productId: item.product.id,
				name: item.product.name,
				quantity: item.quantity,
				unitPrice: item.product.sellPrice,
				costPrice: item.product.costPrice,
				discount: totals.lines[i].discount,
				tax: totals.lines[i].tax,
				lineTotal: totals.lines[i].lineTotal
			}))
		);

		// Cash is recorded as the amount kept (tendered minus change), so the drawer count adds up.
		let changeLeft = settled.change;
		await tx.insert(schema.payments).values(
			payments
				.map((p) => {
					let amount = p.amount;
					if (p.method === 'cash' && changeLeft > 0) {
						const take = Math.min(changeLeft, amount);
						amount -= take;
						changeLeft -= take;
					}
					return { tenantId: auth.tenantId, saleId: input.id, method: p.method, amount, reference: p.reference ?? null };
				})
				.filter((p) => p.amount > 0)
		);

		const tracked = items.filter((i) => i.product.trackStock);
		if (tracked.length) {
			await tx.insert(schema.stockMovements).values(
				tracked.map((i) => ({
					tenantId: auth.tenantId,
					branchId: auth.branchId,
					productId: i.product.id,
					quantity: -i.quantity,
					reason: 'sale' as const,
					refId: input.id,
					userId: auth.userId
				}))
			);
		}

		return { id: input.id, receiptNo, duplicate: false };
	});
}

/** Cancels a whole sale: puts the stock back and records who did it and why. */
export async function voidSale(auth: Auth, saleId: string, reason: string) {
	if (!can(auth.permissions, 'sales.void')) throw new SaleError('Only a manager can void a sale.', 403);
	if (!reason.trim()) throw new SaleError('Give a reason for voiding.');

	return db.transaction(async (tx) => {
		const [sale] = await tx
			.select()
			.from(schema.sales)
			.where(and(eq(schema.sales.id, saleId), eq(schema.sales.tenantId, auth.tenantId)))
			.for('update');
		if (!sale) throw new SaleError('Sale not found.', 404);
		if (sale.status !== 'completed') throw new SaleError('This sale has already been voided or refunded.');

		await tx
			.update(schema.sales)
			.set({ status: 'voided', voidedAt: new Date(), voidedBy: auth.userId, voidReason: reason.trim().slice(0, 300) })
			.where(eq(schema.sales.id, saleId));
		await tx.update(schema.payments).set({ status: 'refunded' }).where(eq(schema.payments.saleId, saleId));

		const moved = await tx
			.select()
			.from(schema.stockMovements)
			.where(and(eq(schema.stockMovements.refId, saleId), eq(schema.stockMovements.reason, 'sale')));
		if (moved.length) {
			await tx.insert(schema.stockMovements).values(
				moved.map((m) => ({
					tenantId: m.tenantId,
					branchId: m.branchId,
					productId: m.productId,
					batchId: m.batchId,
					quantity: -m.quantity,
					reason: 'refund' as const,
					refId: saleId,
					note: `Void ${sale.receiptNo}`,
					userId: auth.userId
				}))
			);
		}

		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'sale.voided',
			entity: 'sale',
			entityId: saleId,
			details: { receiptNo: sale.receiptNo, total: sale.total, reason }
		});
		return sale;
	});
}

/** Totals for a shift: sales, payments by method and the cash that should be in the drawer. */
export async function shiftSummary(shiftId: string, openingCash: number) {
	const [sales] = await db
		.select({
			count: sql<number>`count(*)`.mapWith(Number),
			total: sql<number>`coalesce(sum(${schema.sales.total}), 0)`.mapWith(Number)
		})
		.from(schema.sales)
		.where(and(eq(schema.sales.shiftId, shiftId), eq(schema.sales.status, 'completed')));

	const byMethod = await db
		.select({
			method: schema.payments.method,
			amount: sql<number>`coalesce(sum(${schema.payments.amount}), 0)`.mapWith(Number)
		})
		.from(schema.payments)
		.innerJoin(schema.sales, eq(schema.sales.id, schema.payments.saleId))
		.where(and(eq(schema.sales.shiftId, shiftId), eq(schema.sales.status, 'completed')))
		.groupBy(schema.payments.method);

	const [voided] = await db
		.select({ count: sql<number>`count(*)`.mapWith(Number) })
		.from(schema.sales)
		.where(and(eq(schema.sales.shiftId, shiftId), eq(schema.sales.status, 'voided')));

	const cash = byMethod.find((m) => m.method === 'cash')?.amount ?? 0;
	return {
		salesCount: sales.count,
		salesTotal: sales.total,
		voidedCount: voided.count,
		byMethod,
		expectedCash: openingCash + cash
	};
}

/**
 * One sale with its lines and payments. Staff without the reports permission
 * can only open sales they made themselves.
 */
export async function getSaleDetail(auth: Auth, saleId: string) {
	if (!UUID.test(saleId)) return null;
	const cashier = alias(schema.users, 'cashier');
	const voider = alias(schema.users, 'voider');
	const [row] = await db
		.select({
			sale: schema.sales,
			cashier: cashier.name,
			voidedByName: voider.name,
			branch: schema.branches.name,
			tenant: schema.tenants
		})
		.from(schema.sales)
		.innerJoin(cashier, eq(cashier.id, schema.sales.userId))
		.leftJoin(voider, eq(voider.id, schema.sales.voidedBy))
		.innerJoin(schema.branches, eq(schema.branches.id, schema.sales.branchId))
		.innerJoin(schema.tenants, eq(schema.tenants.id, schema.sales.tenantId))
		.where(and(eq(schema.sales.id, saleId), eq(schema.sales.tenantId, auth.tenantId)));
	if (!row) return null;
	if (row.sale.userId !== auth.userId && !can(auth.permissions, 'reports.view') && !can(auth.permissions, 'sales.void')) return null;

	const [items, payments] = await Promise.all([
		db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, saleId)),
		db.select().from(schema.payments).where(eq(schema.payments.saleId, saleId))
	]);
	return { ...row, items, payments };
}
