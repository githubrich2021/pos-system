import { and, count, eq, gte, inArray, isNotNull, sql, sum } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requireUser(locals);
	const t = auth.tenantId;

	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);

	const [[today], [refundedToday], [products], [staffWithPin], [devices], lowStock] = await Promise.all([
		db
			.select({ total: sum(schema.sales.total).mapWith(Number), count: count() })
			.from(schema.sales)
			.where(and(eq(schema.sales.tenantId, t), inArray(schema.sales.status, [...schema.countedSaleStatuses]), gte(schema.sales.soldAt, startOfDay))),
		// Money given back today, taken off today's takings
		db
			.select({ total: sum(schema.refunds.amount).mapWith(Number) })
			.from(schema.refunds)
			.where(and(eq(schema.refunds.tenantId, t), gte(schema.refunds.createdAt, startOfDay))),
		db
			.select({ count: count() })
			.from(schema.products)
			.where(and(eq(schema.products.tenantId, t), eq(schema.products.isActive, true))),
		db
			.select({ count: count() })
			.from(schema.users)
			.where(and(eq(schema.users.tenantId, t), isNotNull(schema.users.pinHash))),
		db.select({ count: count() }).from(schema.devices).where(eq(schema.devices.tenantId, t)),
		// Products at or below their low-stock level in this branch
		db.execute<{ count: number }>(sql`
			select count(*)::int as count from ${schema.products} p
			left join (
				select product_id, sum(quantity) as qty from ${schema.stockMovements}
				where tenant_id = ${t} and branch_id = ${auth.branchId}
				group by product_id
			) s on s.product_id = p.id
			where p.tenant_id = ${t} and p.is_active and p.track_stock
				and p.low_stock_level is not null and coalesce(s.qty, 0) <= p.low_stock_level
		`)
	]);

	return {
		stats: {
			salesToday: (today?.total ?? 0) - (refundedToday?.total ?? 0),
			salesCountToday: today?.count ?? 0,
			products: products.count,
			lowStock: lowStock[0]?.count ?? 0
		},
		setup: [
			{ label: 'Add your first products', done: products.count > 0, href: '/products/new' },
			{ label: 'Add staff and give them PINs', done: staffWithPin.count > 0, href: '/settings/staff' },
			{ label: 'Set up this computer as a till', done: devices.count > 0, href: '/settings/device' },
			{ label: 'Check your business types (modules)', done: auth.modules.length > 0, href: '/settings/modules' }
		]
	};
};
