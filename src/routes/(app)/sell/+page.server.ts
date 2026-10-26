import { redirect } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requireModule, requirePermission } from '#lib/server/auth/guard.ts';
import { getOpenShift } from '#lib/server/services/sales.ts';
import { can } from '#lib/core/permissions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireModule(locals, 'retail');
	const auth = requirePermission(locals, 'sales.create');

	const shift = await getOpenShift(auth);
	if (!shift) redirect(303, '/shift');

	const stock = db
		.select({
			productId: schema.stockMovements.productId,
			qty: sql<number>`sum(${schema.stockMovements.quantity})`.as('qty')
		})
		.from(schema.stockMovements)
		.where(and(eq(schema.stockMovements.tenantId, auth.tenantId), eq(schema.stockMovements.branchId, auth.branchId)))
		.groupBy(schema.stockMovements.productId)
		.as('stock');

	const products = await db
		.select({
			id: schema.products.id,
			name: schema.products.name,
			sku: schema.products.sku,
			barcode: schema.products.barcode,
			unit: schema.products.unit,
			price: schema.products.sellPrice,
			trackStock: schema.products.trackStock,
			categoryId: schema.products.categoryId,
			taxRateBp: sql<number | null>`case when ${schema.taxRates.isActive} then ${schema.taxRates.rateBp} end`,
			taxInclusive: sql<boolean>`coalesce(${schema.taxRates.inclusive}, true)`,
			stock: sql<number>`coalesce(${stock.qty}, 0)`.mapWith(Number)
		})
		.from(schema.products)
		.leftJoin(schema.taxRates, eq(schema.taxRates.id, schema.products.taxRateId))
		.leftJoin(stock, eq(stock.productId, schema.products.id))
		.where(and(eq(schema.products.tenantId, auth.tenantId), eq(schema.products.isActive, true)))
		.orderBy(asc(schema.products.name))
		.limit(5000);

	const categories = await db
		.select({ id: schema.categories.id, name: schema.categories.name })
		.from(schema.categories)
		.where(eq(schema.categories.tenantId, auth.tenantId))
		.orderBy(asc(schema.categories.name));

	return {
		products,
		categories: categories.filter((c) => products.some((p) => p.categoryId === c.id)),
		canDiscount: can(auth.permissions, 'sales.discount'),
		canAddCustomer: can(auth.permissions, 'customers.manage'),
		shiftOpenedAt: shift.openedAt
	};
};
