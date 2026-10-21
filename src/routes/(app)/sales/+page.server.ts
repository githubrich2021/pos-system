import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '#lib/server/db/index.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { can } from '#lib/core/permissions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requireUser(locals);
	const seeAll = can(auth.permissions, 'reports.view') || can(auth.permissions, 'sales.void');

	// Day to show (local date, YYYY-MM-DD); defaults to today
	const today = new Date().toLocaleDateString('en-CA');
	const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') ?? '') ? url.searchParams.get('date')! : today;
	const from = new Date(`${date}T00:00:00`);
	const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);

	const cashier = alias(schema.users, 'cashier');
	const where = and(
		eq(schema.sales.tenantId, auth.tenantId),
		gte(schema.sales.soldAt, from),
		lt(schema.sales.soldAt, to),
		seeAll ? undefined : eq(schema.sales.userId, auth.userId)
	);

	const sales = await db
		.select({
			id: schema.sales.id,
			receiptNo: schema.sales.receiptNo,
			soldAt: schema.sales.soldAt,
			total: schema.sales.total,
			status: schema.sales.status,
			cashier: cashier.name,
			methods: sql<string[]>`(select array_agg(distinct p.method) from ${schema.payments} p where p.sale_id = ${schema.sales.id})`,
			items: sql<number>`(select count(*) from ${schema.saleItems} i where i.sale_id = ${schema.sales.id})`.mapWith(Number)
		})
		.from(schema.sales)
		.innerJoin(cashier, eq(cashier.id, schema.sales.userId))
		.where(where)
		.orderBy(desc(schema.sales.soldAt))
		.limit(500);

	const completed = sales.filter((s) => s.status === 'completed');
	return {
		sales,
		date,
		isToday: date === today,
		seeAll,
		summary: { count: completed.length, total: completed.reduce((a, s) => a + s.total, 0) }
	};
};
