import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { listMovements, stockSubquery } from '#lib/server/services/stock.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const q = url.searchParams.get('q')?.trim() ?? '';
	const show = url.searchParams.get('show') ?? 'all';

	const stock = stockSubquery(auth);
	const rows = await db
		.select({
			id: schema.products.id,
			name: schema.products.name,
			sku: schema.products.sku,
			barcode: schema.products.barcode,
			unit: schema.products.unit,
			costPrice: schema.products.costPrice,
			sellPrice: schema.products.sellPrice,
			lowStockLevel: schema.products.lowStockLevel,
			category: schema.categories.name,
			stock: sql<number>`coalesce(${stock.qty}, 0)`.mapWith(Number)
		})
		.from(schema.products)
		.leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
		.leftJoin(stock, eq(stock.productId, schema.products.id))
		.where(
			and(
				eq(schema.products.tenantId, auth.tenantId),
				eq(schema.products.isActive, true),
				eq(schema.products.trackStock, true)
			)
		)
		.orderBy(asc(schema.products.name))
		.limit(5000);

	const isOut = (p: (typeof rows)[number]) => p.stock <= 0;
	const isLow = (p: (typeof rows)[number]) => !isOut(p) && p.lowStockLevel !== null && p.stock <= p.lowStockLevel;

	const summary = {
		products: rows.length,
		// Negative stock (sold before it was received) shouldn't reduce the value
		costValue: rows.reduce((sum, p) => sum + Math.round(Math.max(p.stock, 0) * p.costPrice), 0),
		retailValue: rows.reduce((sum, p) => sum + Math.round(Math.max(p.stock, 0) * p.sellPrice), 0),
		low: rows.filter(isLow).length,
		out: rows.filter(isOut).length
	};

	const needle = q.toLowerCase();
	const products = rows
		.filter((p) => (show === 'low' ? isLow(p) : show === 'out' ? isOut(p) : true))
		.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.sku?.toLowerCase() === needle || p.barcode === q)
		.map((p) => ({ ...p, status: isOut(p) ? 'out' : isLow(p) ? 'low' : 'ok' }));

	const recent = await listMovements(auth, { limit: 8 });
	return { products, summary, recent, q, show };
};
