import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db, schema } from '../db';

type Auth = NonNullable<App.Locals['auth']>;

/**
 * Report rules (so every number on the page agrees with every other):
 *  - A sale belongs to the day it was made (sold_at, in the business's time zone). Voided sales don't count.
 *  - A refund belongs to the day the money went back, and is taken off that period's sales.
 *  - Profit = sales after refunds, without VAT, minus the cost of what was sold.
 *    Returned items that went back on the shelf give their cost back; damaged returns don't.
 */
export interface ReportRange {
	from: string; // YYYY-MM-DD, inclusive
	to: string; // YYYY-MM-DD, inclusive
	branchId?: string | null;
}

async function tenantTimezone(tenantId: string) {
	const [t] = await db.select({ tz: schema.tenants.timezone }).from(schema.tenants).where(eq(schema.tenants.id, tenantId));
	return t?.tz ?? 'Africa/Accra';
}

/** The local calendar day of a timestamp column, in the business's time zone. */
const localDay = (col: SQL | AnyPgColumn, tz: string) => sql<string>`to_char((${col} at time zone ${tz})::date, 'YYYY-MM-DD')`;
const inRange = (col: SQL | AnyPgColumn, tz: string, r: ReportRange) =>
	sql`(${col} at time zone ${tz})::date between ${r.from}::date and ${r.to}::date`;

export async function salesReport(auth: Auth, range: ReportRange) {
	const tz = await tenantTimezone(auth.tenantId);
	const S = schema.sales;
	const R = schema.refunds;
	const branchSales = range.branchId ? eq(S.branchId, range.branchId) : undefined;
	const branchRefunds = range.branchId ? eq(R.branchId, range.branchId) : undefined;
	const counted = inArray(S.status, [...schema.countedSaleStatuses]);
	const salesWhere = and(eq(S.tenantId, auth.tenantId), counted, inRange(S.soldAt, tz, range), branchSales);
	const refundsWhere = and(eq(R.tenantId, auth.tenantId), inRange(R.createdAt, tz, range), branchRefunds);

	const n = (col: SQL) => sql<number>`coalesce(${col}, 0)`.mapWith(Number);

	const [
		[totals],
		[refundTotals],
		[cost],
		[refundCost],
		[voids],
		byDay,
		refundsByDay,
		products,
		refundedProducts,
		cashiers,
		methods,
		refundMethods,
		repayments,
		[losses]
	] = await Promise.all([
		db
			.select({
				count: sql<number>`count(*)`.mapWith(Number),
				subtotal: n(sql`sum(${S.subtotal})`),
				discount: n(sql`sum(${S.discountTotal})`),
				tax: n(sql`sum(${S.taxTotal})`),
				total: n(sql`sum(${S.total})`)
			})
			.from(S)
			.where(salesWhere),
		db
			.select({ count: sql<number>`count(*)`.mapWith(Number), amount: n(sql`sum(${R.amount})`), tax: n(sql`sum(${R.tax})`) })
			.from(R)
			.where(refundsWhere),
		// Cost of what was sold (cost price copied onto each line at sale time)
		db
			.select({ cost: n(sql`sum(round(${schema.saleItems.costPrice} * ${schema.saleItems.quantity}))`) })
			.from(schema.saleItems)
			.innerJoin(S, eq(S.id, schema.saleItems.saleId))
			.where(salesWhere),
		db
			.select({ cost: n(sql`sum(round(${schema.saleItems.costPrice} * ${schema.refundItems.quantity}))`) })
			.from(schema.refundItems)
			.innerJoin(R, eq(R.id, schema.refundItems.refundId))
			.innerJoin(schema.saleItems, eq(schema.saleItems.id, schema.refundItems.saleItemId))
			.where(and(refundsWhere, eq(schema.refundItems.restocked, true))),
		db
			.select({ count: sql<number>`count(*)`.mapWith(Number), total: n(sql`sum(${S.total})`) })
			.from(S)
			.where(and(eq(S.tenantId, auth.tenantId), eq(S.status, 'voided'), inRange(S.soldAt, tz, range), branchSales)),
		db
			.select({ day: localDay(S.soldAt, tz), count: sql<number>`count(*)`.mapWith(Number), total: n(sql`sum(${S.total})`) })
			.from(S)
			.where(salesWhere)
			.groupBy(sql`1`),
		db
			.select({ day: localDay(R.createdAt, tz), amount: n(sql`sum(${R.amount})`) })
			.from(R)
			.where(refundsWhere)
			.groupBy(sql`1`),
		db
			.select({
				productId: schema.saleItems.productId,
				name: sql<string>`max(${schema.saleItems.name})`,
				category: sql<string | null>`max(${schema.categories.name})`,
				unit: sql<string | null>`max(${schema.products.unit})`,
				quantity: n(sql`sum(${schema.saleItems.quantity})`),
				total: n(sql`sum(${schema.saleItems.lineTotal})`),
				tax: n(sql`sum(${schema.saleItems.tax})`),
				cost: n(sql`sum(round(${schema.saleItems.costPrice} * ${schema.saleItems.quantity}))`)
			})
			.from(schema.saleItems)
			.innerJoin(S, eq(S.id, schema.saleItems.saleId))
			.leftJoin(schema.products, eq(schema.products.id, schema.saleItems.productId))
			.leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
			.where(salesWhere)
			// Deleted products are grouped by the name on the receipt
			.groupBy(schema.saleItems.productId, sql`case when ${schema.saleItems.productId} is null then ${schema.saleItems.name} end`),
		db
			.select({
				productId: schema.refundItems.productId,
				name: sql<string>`max(${schema.refundItems.name})`,
				quantity: n(sql`sum(${schema.refundItems.quantity})`),
				amount: n(sql`sum(${schema.refundItems.amount})`),
				tax: n(sql`sum(${schema.refundItems.tax})`),
				cost: n(sql`sum(case when ${schema.refundItems.restocked} then round(${schema.saleItems.costPrice} * ${schema.refundItems.quantity}) else 0 end)`)
			})
			.from(schema.refundItems)
			.innerJoin(R, eq(R.id, schema.refundItems.refundId))
			.innerJoin(schema.saleItems, eq(schema.saleItems.id, schema.refundItems.saleItemId))
			.where(refundsWhere)
			.groupBy(schema.refundItems.productId, sql`case when ${schema.refundItems.productId} is null then ${schema.refundItems.name} end`),
		db
			.select({
				userId: S.userId,
				name: sql<string>`max(${schema.users.name})`,
				count: sql<number>`count(*)`.mapWith(Number),
				total: n(sql`sum(${S.total})`),
				discount: n(sql`sum(${S.discountTotal})`)
			})
			.from(S)
			.innerJoin(schema.users, eq(schema.users.id, S.userId))
			.where(salesWhere)
			.groupBy(S.userId),
		db
			.select({ method: schema.payments.method, amount: n(sql`sum(${schema.payments.amount})`) })
			.from(schema.payments)
			.innerJoin(S, eq(S.id, schema.payments.saleId))
			.where(salesWhere)
			.groupBy(schema.payments.method),
		db.select({ method: R.method, amount: n(sql`sum(${R.amount})`) }).from(R).where(refundsWhere).groupBy(R.method),
		db
			.select({ method: schema.customerPayments.method, amount: n(sql`sum(${schema.customerPayments.amount})`) })
			.from(schema.customerPayments)
			.where(
				and(
					eq(schema.customerPayments.tenantId, auth.tenantId),
					sql`${schema.customerPayments.voidedAt} is null`,
					inRange(schema.customerPayments.paidAt, tz, range),
					range.branchId ? eq(schema.customerPayments.branchId, range.branchId) : undefined
				)
			)
			.groupBy(schema.customerPayments.method),
		// Stock thrown away or lost, valued at today's cost price
		db
			.select({ value: n(sql`sum(round(-${schema.stockMovements.quantity} * ${schema.products.costPrice}))`) })
			.from(schema.stockMovements)
			.innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
			.where(
				and(
					eq(schema.stockMovements.tenantId, auth.tenantId),
					inArray(schema.stockMovements.reason, ['damage', 'expired', 'loss']),
					inRange(schema.stockMovements.createdAt, tz, range),
					range.branchId ? eq(schema.stockMovements.branchId, range.branchId) : undefined
				)
			)
	]);

	// ── Summary
	const netSales = totals.total - refundTotals.amount;
	const vat = totals.tax - refundTotals.tax;
	const netExVat = netSales - vat;
	const costOfSales = cost.cost - refundCost.cost;
	const profit = netExVat - costOfSales;
	const creditGiven = methods.find((m) => m.method === 'credit')?.amount ?? 0;

	// ── By day: every day in the range, including days with no sales
	const days: { day: string; count: number; sales: number; refunds: number; net: number }[] = [];
	const salesDay = new Map(byDay.map((d) => [d.day, d]));
	const refundDay = new Map(refundsByDay.map((d) => [d.day, d.amount]));
	for (let d = new Date(`${range.from}T00:00:00Z`); d <= new Date(`${range.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
		const key = d.toISOString().slice(0, 10);
		const sales = salesDay.get(key)?.total ?? 0;
		const refunds = refundDay.get(key) ?? 0;
		days.push({ day: key, count: salesDay.get(key)?.count ?? 0, sales, refunds, net: sales - refunds });
	}

	// ── By product: sold minus returned
	const key = (p: { productId: string | null; name: string }) => p.productId ?? `name:${p.name}`;
	const productRows = new Map(
		products.map((p) => [
			key(p),
			{ ...p, returned: 0, refunded: 0, refundTax: 0, refundCost: 0 }
		])
	);
	for (const r of refundedProducts) {
		const row = productRows.get(key(r)) ?? {
			productId: r.productId,
			name: r.name,
			category: null,
			unit: null,
			quantity: 0,
			total: 0,
			tax: 0,
			cost: 0,
			returned: 0,
			refunded: 0,
			refundTax: 0,
			refundCost: 0
		};
		row.returned += r.quantity;
		row.refunded += r.amount;
		row.refundTax += r.tax;
		row.refundCost += r.cost;
		productRows.set(key(r), row);
	}
	const byProduct = [...productRows.values()]
		.map((p) => {
			const net = p.total - p.refunded;
			const netExVat = net - (p.tax - p.refundTax);
			const cost = p.cost - p.refundCost;
			return {
				name: p.name,
				category: p.category ?? 'No category',
				unit: p.unit ?? '',
				sold: Math.round((p.quantity - p.returned) * 1000) / 1000,
				returned: p.returned,
				net,
				cost,
				profit: netExVat - cost
			};
		})
		.sort((a, b) => b.net - a.net);

	const categoryMap = new Map<string, { category: string; net: number; cost: number; profit: number; products: number }>();
	for (const p of byProduct) {
		const c = categoryMap.get(p.category) ?? { category: p.category, net: 0, cost: 0, profit: 0, products: 0 };
		c.net += p.net;
		c.cost += p.cost;
		c.profit += p.profit;
		c.products++;
		categoryMap.set(p.category, c);
	}

	// ── Payments: money in by method, refunds out, and customer repayments
	const methodKeys = ['cash', 'momo', 'card', 'bank', 'credit', 'account'];
	const byMethod = methodKeys
		.map((m) => {
			const taken = methods.find((x) => x.method === m)?.amount ?? 0;
			const refunded = refundMethods.find((x) => x.method === m)?.amount ?? 0;
			const repaid = repayments.find((x) => x.method === m)?.amount ?? 0;
			return { method: m, taken, refunded, repaid, net: taken - refunded + repaid };
		})
		.filter((m) => m.taken || m.refunded || m.repaid);

	return {
		summary: {
			salesCount: totals.count,
			grossSales: totals.subtotal,
			discounts: totals.discount,
			salesTotal: totals.total,
			refunds: refundTotals.amount,
			refundCount: refundTotals.count,
			netSales,
			vat,
			netExVat,
			costOfSales,
			profit,
			margin: netExVat > 0 ? profit / netExVat : null,
			averageSale: totals.count ? Math.round(totals.total / totals.count) : 0,
			voidedCount: voids.count,
			voidedTotal: voids.total,
			creditGiven,
			repaid: repayments.reduce((a, r) => a + r.amount, 0),
			stockLosses: losses?.value ?? 0
		},
		days,
		byProduct,
		byCategory: [...categoryMap.values()].sort((a, b) => b.net - a.net),
		byCashier: cashiers.sort((a, b) => b.total - a.total),
		byMethod
	};
}
