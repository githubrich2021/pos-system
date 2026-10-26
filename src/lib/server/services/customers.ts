import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { can } from '../../core/permissions';
import { isEmail } from '../utils/form';
import { getOpenShift } from './sales';

type Auth = NonNullable<App.Locals['auth']>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class CustomerError extends Error {
	constructor(message: string, public status = 400) {
		super(message);
	}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export const REPAYMENT_METHODS = { cash: 'Cash', momo: 'Mobile money', card: 'Card', bank: 'Bank transfer' } as const;
export type RepaymentMethod = keyof typeof REPAYMENT_METHODS;

// ─── Balances ───────────────────────────────────────────────────────────────
// What a customer owes = "pay later" amounts on their sales − refunds taken off their account − repayments.
// Nothing is stored as a running total, so a void, refund or repayment can never leave it out of date.

/** Pay-later amount per customer, less refunds taken off their account. */
function owedSelect(exec: typeof db | Tx, tenantId: string, customerIds?: string[]) {
	const perSale = sql<number>`(
		select coalesce(sum(p.amount), 0) from ${schema.payments} p
		where p.sale_id = ${schema.sales.id} and p.method = 'credit' and p.status = 'paid'
	) - (
		select coalesce(sum(r.amount), 0) from ${schema.refunds} r
		where r.sale_id = ${schema.sales.id} and r.method = 'account'
	)`;
	return exec
		.select({ customerId: schema.sales.customerId, owed: sql<number>`sum(${perSale})`.mapWith(Number).as('owed') })
		.from(schema.sales)
		.where(
			and(
				eq(schema.sales.tenantId, tenantId),
				inArray(schema.sales.status, [...schema.countedSaleStatuses]),
				customerIds ? inArray(schema.sales.customerId, customerIds) : isNotNull(schema.sales.customerId)
			)
		)
		.groupBy(schema.sales.customerId);
}

function creditSubquery(tenantId: string) {
	return owedSelect(db, tenantId).as('credit');
}

/** Repayment totals per customer, as a subquery. */
function repaidSubquery(tenantId: string) {
	return db
		.select({
			customerId: schema.customerPayments.customerId,
			repaid: sql<number>`sum(${schema.customerPayments.amount})`.as('repaid')
		})
		.from(schema.customerPayments)
		.where(and(eq(schema.customerPayments.tenantId, tenantId), isNull(schema.customerPayments.voidedAt)))
		.groupBy(schema.customerPayments.customerId)
		.as('repaid');
}

/** Balances for some customers. Positive = they owe the business. */
export async function customerBalances(exec: typeof db | Tx, tenantId: string, customerIds: string[]) {
	const result = new Map<string, number>();
	if (customerIds.length === 0) return result;
	const [owed, repaid] = await Promise.all([
		owedSelect(exec, tenantId, customerIds),
		exec
			.select({ customerId: schema.customerPayments.customerId, total: sql<number>`sum(${schema.customerPayments.amount})`.mapWith(Number) })
			.from(schema.customerPayments)
			.where(
				and(
					eq(schema.customerPayments.tenantId, tenantId),
					isNull(schema.customerPayments.voidedAt),
					inArray(schema.customerPayments.customerId, customerIds)
				)
			)
			.groupBy(schema.customerPayments.customerId)
	]);
	for (const id of customerIds) result.set(id, 0);
	for (const r of owed) if (r.customerId) result.set(r.customerId, (result.get(r.customerId) ?? 0) + r.owed);
	for (const r of repaid) result.set(r.customerId, (result.get(r.customerId) ?? 0) - r.total);
	return result;
}

/** Customers with what they owe. `owing` = only those with a balance. */
export async function listCustomers(auth: Auth, opts: { q?: string; owing?: boolean; limit?: number } = {}) {
	const credit = creditSubquery(auth.tenantId);
	const repaid = repaidSubquery(auth.tenantId);
	const balance = sql<number>`coalesce(${credit.owed}, 0) - coalesce(${repaid.repaid}, 0)`;
	const q = opts.q?.trim();
	return db
		.select({
			id: schema.customers.id,
			name: schema.customers.name,
			phone: schema.customers.phone,
			email: schema.customers.email,
			creditLimit: schema.customers.creditLimit,
			balance: balance.mapWith(Number)
		})
		.from(schema.customers)
		.leftJoin(credit, eq(credit.customerId, schema.customers.id))
		.leftJoin(repaid, eq(repaid.customerId, schema.customers.id))
		.where(
			and(
				eq(schema.customers.tenantId, auth.tenantId),
				q ? or(ilike(schema.customers.name, `%${q}%`), ilike(schema.customers.phone, `%${q.replace(/\s+/g, '')}%`)) : undefined,
				opts.owing ? sql`${balance} > 0` : undefined
			)
		)
		.orderBy(opts.owing ? desc(balance) : asc(schema.customers.name))
		.limit(opts.limit ?? 200);
}

/** Total owed to the business by all customers. */
export async function totalOwed(auth: Auth) {
	const credit = creditSubquery(auth.tenantId);
	const repaid = repaidSubquery(auth.tenantId);
	const [row] = await db
		.select({
			total: sql<number>`coalesce(sum(greatest(coalesce(${credit.owed}, 0) - coalesce(${repaid.repaid}, 0), 0)), 0)`.mapWith(Number),
			count: sql<number>`count(*) filter (where coalesce(${credit.owed}, 0) - coalesce(${repaid.repaid}, 0) > 0)`.mapWith(Number)
		})
		.from(schema.customers)
		.leftJoin(credit, eq(credit.customerId, schema.customers.id))
		.leftJoin(repaid, eq(repaid.customerId, schema.customers.id))
		.where(eq(schema.customers.tenantId, auth.tenantId));
	return row;
}

// ─── Customer records ───────────────────────────────────────────────────────

export interface CustomerInput {
	name: string;
	phone?: string;
	email?: string;
	notes?: string;
	/** Pesewas. Only applied for users allowed to set credit limits. */
	creditLimit?: number;
}

/** Ghana numbers are often typed with spaces or +233. Keep digits and a leading +. */
export const cleanPhone = (v: string) => v.replace(/[^\d+]/g, '').slice(0, 20);

function readInput(auth: Auth, input: CustomerInput) {
	const name = input.name?.trim().slice(0, 120);
	if (!name) throw new CustomerError("Enter the customer's name.");
	const phone = input.phone ? cleanPhone(input.phone) || null : null;
	const email = input.email?.trim().toLowerCase().slice(0, 120) || null;
	if (email && !isEmail(email)) throw new CustomerError('Enter a valid email address.');
	const values: { name: string; phone: string | null; email: string | null; notes: string | null; creditLimit?: number } = {
		name,
		phone,
		email,
		notes: input.notes?.trim().slice(0, 500) || null
	};
	if (input.creditLimit !== undefined && can(auth.permissions, 'customers.credit')) {
		const limit = Math.round(Number(input.creditLimit));
		if (!Number.isFinite(limit) || limit < 0 || limit > 100_000_000) throw new CustomerError('Enter a valid credit limit.');
		values.creditLimit = limit;
	}
	return values;
}

async function phoneTaken(tenantId: string, phone: string | null, exceptId?: string) {
	if (!phone) return null;
	const [dupe] = await db
		.select({ id: schema.customers.id, name: schema.customers.name })
		.from(schema.customers)
		.where(and(eq(schema.customers.tenantId, tenantId), eq(schema.customers.phone, phone)));
	return dupe && dupe.id !== exceptId ? dupe : null;
}

export async function createCustomer(auth: Auth, input: CustomerInput) {
	if (!can(auth.permissions, 'customers.manage')) throw new CustomerError('You are not allowed to add customers.', 403);
	const values = readInput(auth, input);
	const dupe = await phoneTaken(auth.tenantId, values.phone);
	if (dupe) throw new CustomerError(`${dupe.name} already uses this phone number.`);
	const [customer] = await db.insert(schema.customers).values({ tenantId: auth.tenantId, ...values }).returning();
	await db.insert(schema.auditLog).values({
		tenantId: auth.tenantId,
		userId: auth.userId,
		action: 'customer.created',
		entity: 'customer',
		entityId: customer.id,
		details: { name: customer.name, creditLimit: customer.creditLimit }
	});
	return customer;
}

export async function updateCustomer(auth: Auth, customerId: string, input: CustomerInput) {
	if (!can(auth.permissions, 'customers.manage')) throw new CustomerError('You are not allowed to edit customers.', 403);
	if (!isUuid(customerId)) throw new CustomerError('Customer not found.', 404);
	const values = readInput(auth, input);
	const dupe = await phoneTaken(auth.tenantId, values.phone, customerId);
	if (dupe) throw new CustomerError(`${dupe.name} already uses this phone number.`);

	const [before] = await db
		.select()
		.from(schema.customers)
		.where(and(eq(schema.customers.id, customerId), eq(schema.customers.tenantId, auth.tenantId)));
	if (!before) throw new CustomerError('Customer not found.', 404);

	const [customer] = await db.update(schema.customers).set(values).where(eq(schema.customers.id, customerId)).returning();
	await db.insert(schema.auditLog).values({
		tenantId: auth.tenantId,
		userId: auth.userId,
		action: 'customer.updated',
		entity: 'customer',
		entityId: customerId,
		details:
			values.creditLimit !== undefined && values.creditLimit !== before.creditLimit
				? { name: customer.name, creditLimit: { from: before.creditLimit, to: values.creditLimit } }
				: { name: customer.name }
	});
	return customer;
}

export async function getCustomer(auth: Auth, customerId: string) {
	if (!isUuid(customerId)) return null;
	const [customer] = await db
		.select()
		.from(schema.customers)
		.where(and(eq(schema.customers.id, customerId), eq(schema.customers.tenantId, auth.tenantId)));
	if (!customer) return null;
	const balance = (await customerBalances(db, auth.tenantId, [customerId])).get(customerId) ?? 0;
	return { ...customer, balance, available: Math.max(0, customer.creditLimit - balance) };
}

/**
 * Everything that changed what the customer owes, oldest first, with a running balance.
 * Also lists their other (fully paid) purchases so staff can see their history.
 */
export async function customerStatement(auth: Auth, customerId: string) {
	const [sales, repayments, accountRefunds] = await Promise.all([
		db
			.select({
				id: schema.sales.id,
				receiptNo: schema.sales.receiptNo,
				status: schema.sales.status,
				total: schema.sales.total,
				soldAt: schema.sales.soldAt,
				credit: sql<number>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.method} = 'credit' and ${schema.payments.status} = 'paid'), 0)`.mapWith(Number)
			})
			.from(schema.sales)
			.leftJoin(schema.payments, eq(schema.payments.saleId, schema.sales.id))
			.where(and(eq(schema.sales.tenantId, auth.tenantId), eq(schema.sales.customerId, customerId)))
			.groupBy(schema.sales.id)
			.orderBy(asc(schema.sales.soldAt)),
		db
			.select({
				id: schema.customerPayments.id,
				method: schema.customerPayments.method,
				amount: schema.customerPayments.amount,
				reference: schema.customerPayments.reference,
				note: schema.customerPayments.note,
				paidAt: schema.customerPayments.paidAt,
				voidedAt: schema.customerPayments.voidedAt,
				voidReason: schema.customerPayments.voidReason,
				user: schema.users.name
			})
			.from(schema.customerPayments)
			.leftJoin(schema.users, eq(schema.users.id, schema.customerPayments.userId))
			.where(and(eq(schema.customerPayments.tenantId, auth.tenantId), eq(schema.customerPayments.customerId, customerId)))
			.orderBy(asc(schema.customerPayments.paidAt)),
		// Refunds that were taken off what they owe (refunds paid out in cash don't change the balance)
		db
			.select({
				id: schema.refunds.id,
				saleId: schema.refunds.saleId,
				receiptNo: schema.sales.receiptNo,
				amount: schema.refunds.amount,
				reason: schema.refunds.reason,
				at: schema.refunds.createdAt
			})
			.from(schema.refunds)
			.innerJoin(schema.sales, eq(schema.sales.id, schema.refunds.saleId))
			.where(
				and(eq(schema.refunds.tenantId, auth.tenantId), eq(schema.sales.customerId, customerId), eq(schema.refunds.method, 'account'))
			)
	]);

	type Entry =
		| { kind: 'sale'; id: string; at: Date; receiptNo: string; status: string; total: number; change: number; balance: number }
		| {
				kind: 'payment';
				id: string;
				at: Date;
				method: string;
				reference: string | null;
				note: string | null;
				user: string | null;
				voided: boolean;
				voidReason: string | null;
				amount: number;
				change: number;
				balance: number;
		  }
		| { kind: 'refund'; id: string; at: Date; saleId: string; receiptNo: string; reason: string; amount: number; change: number; balance: number };

	const entries: Entry[] = [
		...sales.map((s) => ({
			kind: 'sale' as const,
			id: s.id,
			at: s.soldAt,
			receiptNo: s.receiptNo,
			status: s.status,
			total: s.total,
			// A voided sale no longer counts towards the balance
			change: s.status === 'voided' ? 0 : s.credit,
			balance: 0
		})),
		...repayments.map((p) => ({
			kind: 'payment' as const,
			id: p.id,
			at: p.paidAt,
			method: p.method,
			reference: p.reference,
			note: p.note,
			user: p.user,
			voided: p.voidedAt !== null,
			voidReason: p.voidReason,
			change: p.voidedAt ? 0 : -p.amount,
			amount: p.amount,
			balance: 0
		})),
		...accountRefunds.map((r) => ({ kind: 'refund' as const, ...r, change: -r.amount, balance: 0 }))
	].sort((a, b) => a.at.getTime() - b.at.getTime());

	let running = 0;
	for (const e of entries) {
		running += e.change;
		e.balance = running;
	}
	return entries.reverse();
}

// ─── Repayments ─────────────────────────────────────────────────────────────

export interface RepaymentInput {
	/** UUID made in the browser so a double submit records the payment once. */
	id: string;
	method: string;
	amount: number;
	reference?: string;
	note?: string;
}

/** Records money a customer paid towards their balance. */
export async function recordRepayment(auth: Auth, customerId: string, input: RepaymentInput) {
	if (!can(auth.permissions, 'customers.manage')) throw new CustomerError('You are not allowed to take customer payments.', 403);
	if (!isUuid(input.id)) throw new CustomerError('Invalid payment ID.');
	if (!(input.method in REPAYMENT_METHODS)) throw new CustomerError('Choose how they paid.');
	const amount = Math.round(Number(input.amount));
	if (!Number.isFinite(amount) || amount <= 0) throw new CustomerError('Enter an amount above zero.');

	const [existing] = await db
		.select({ id: schema.customerPayments.id, tenantId: schema.customerPayments.tenantId })
		.from(schema.customerPayments)
		.where(eq(schema.customerPayments.id, input.id));
	if (existing) {
		if (existing.tenantId !== auth.tenantId) throw new CustomerError('Invalid payment ID.');
		return { id: existing.id, duplicate: true };
	}

	const shift = await getOpenShift(auth);
	if (input.method === 'cash' && !shift) {
		throw new CustomerError('Open a shift first, so this cash is counted in your drawer.', 409);
	}

	return db.transaction(async (tx) => {
		// Lock the customer so two payments at once can't both pass the balance check
		const [customer] = await tx
			.select()
			.from(schema.customers)
			.where(and(eq(schema.customers.id, customerId), eq(schema.customers.tenantId, auth.tenantId)))
			.for('update');
		if (!customer) throw new CustomerError('Customer not found.', 404);

		const balance = (await customerBalances(tx, auth.tenantId, [customer.id])).get(customer.id) ?? 0;
		if (balance <= 0) throw new CustomerError(`${customer.name} doesn't owe anything.`);
		if (amount > balance) throw new CustomerError(`That's more than the ${(balance / 100).toFixed(2)} ${auth.currency} they owe.`);

		await tx.insert(schema.customerPayments).values({
			id: input.id,
			tenantId: auth.tenantId,
			customerId: customer.id,
			branchId: auth.branchId,
			shiftId: shift?.id ?? null,
			userId: auth.userId,
			method: input.method as RepaymentMethod,
			amount,
			reference: input.reference?.trim().slice(0, 100) || null,
			note: input.note?.trim().slice(0, 300) || null
		});
		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'customer.payment',
			entity: 'customer',
			entityId: customer.id,
			details: { paymentId: input.id, amount, method: input.method, balanceBefore: balance }
		});
		return { id: input.id, duplicate: false, balance: balance - amount };
	});
}

/** Cancels a repayment entered by mistake. Managers only, with a reason. */
export async function voidRepayment(auth: Auth, paymentId: string, reason: string) {
	if (!can(auth.permissions, 'sales.void')) throw new CustomerError('Only a manager can cancel a payment.', 403);
	if (!reason.trim()) throw new CustomerError('Give a reason for cancelling.');
	if (!isUuid(paymentId)) throw new CustomerError('Payment not found.', 404);

	return db.transaction(async (tx) => {
		const [payment] = await tx
			.select()
			.from(schema.customerPayments)
			.where(and(eq(schema.customerPayments.id, paymentId), eq(schema.customerPayments.tenantId, auth.tenantId)))
			.for('update');
		if (!payment) throw new CustomerError('Payment not found.', 404);
		if (payment.voidedAt) throw new CustomerError('This payment was already cancelled.');

		await tx
			.update(schema.customerPayments)
			.set({ voidedAt: new Date(), voidedBy: auth.userId, voidReason: reason.trim().slice(0, 300) })
			.where(eq(schema.customerPayments.id, paymentId));
		await tx.insert(schema.auditLog).values({
			tenantId: auth.tenantId,
			userId: auth.userId,
			action: 'customer.payment_voided',
			entity: 'customer',
			entityId: payment.customerId,
			details: { paymentId, amount: payment.amount, reason }
		});
		return payment;
	});
}

/** One repayment, for its printed receipt. */
export async function getRepayment(auth: Auth, paymentId: string) {
	if (!isUuid(paymentId)) return null;
	const [row] = await db
		.select({
			payment: schema.customerPayments,
			customer: schema.customers.name,
			customerPhone: schema.customers.phone,
			takenBy: schema.users.name,
			tenant: schema.tenants
		})
		.from(schema.customerPayments)
		.innerJoin(schema.customers, eq(schema.customers.id, schema.customerPayments.customerId))
		.innerJoin(schema.tenants, eq(schema.tenants.id, schema.customerPayments.tenantId))
		.leftJoin(schema.users, eq(schema.users.id, schema.customerPayments.userId))
		.where(and(eq(schema.customerPayments.id, paymentId), eq(schema.customerPayments.tenantId, auth.tenantId)));
	if (!row) return null;

	// Their balance now, printed on the receipt
	const balanceNow = (await customerBalances(db, auth.tenantId, [row.payment.customerId])).get(row.payment.customerId) ?? 0;
	return { ...row, balanceNow };
}
