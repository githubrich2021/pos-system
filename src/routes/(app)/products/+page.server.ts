import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requirePermission(locals, 'products.view');
	const q = url.searchParams.get('q')?.trim() ?? '';

	// Current stock in this branch = sum of all stock movements.
	const stock = db
		.select({
			productId: schema.stockMovements.productId,
			qty: sql<number>`sum(${schema.stockMovements.quantity})`.mapWith(Number).as('qty')
		})
		.from(schema.stockMovements)
		.where(and(eq(schema.stockMovements.tenantId, auth.tenantId), eq(schema.stockMovements.branchId, auth.branchId)))
		.groupBy(schema.stockMovements.productId)
		.as('stock');

	const search = q
		? or(
				ilike(schema.products.name, `%${q}%`),
				eq(schema.products.sku, q),
				eq(schema.products.barcode, q)
			)
		: undefined;

	const products = await db
		.select({
			id: schema.products.id,
			name: schema.products.name,
			sku: schema.products.sku,
			barcode: schema.products.barcode,
			unit: schema.products.unit,
			sellPrice: schema.products.sellPrice,
			trackStock: schema.products.trackStock,
			lowStockLevel: schema.products.lowStockLevel,
			category: schema.categories.name,
			stock: sql<number>`coalesce(${stock.qty}, 0)`.mapWith(Number)
		})
		.from(schema.products)
		.leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
		.leftJoin(stock, eq(stock.productId, schema.products.id))
		.where(and(eq(schema.products.tenantId, auth.tenantId), eq(schema.products.isActive, true), search))
		.orderBy(asc(schema.products.name))
		.limit(200);

	return { products, q };
};
