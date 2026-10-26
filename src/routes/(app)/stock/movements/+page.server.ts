import { and, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { isUuid, listMovements, listStockProducts, stockLevels } from '#lib/server/services/stock.ts';
import { STOCK_REASON_LABELS } from '#lib/core/stock.ts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const productId = url.searchParams.get('product');
	const reasonParam = url.searchParams.get('reason');
	const reason = reasonParam && reasonParam in STOCK_REASON_LABELS ? reasonParam : null;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	let product = null;
	if (isUuid(productId)) {
		[product] = await db
			.select({ id: schema.products.id, name: schema.products.name, unit: schema.products.unit })
			.from(schema.products)
			.where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, auth.tenantId)));
	}

	// Fetch one extra row to know if there is a next page
	const [rows, products, levels] = await Promise.all([
		listMovements(auth, { productId: product?.id, reason, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
		listStockProducts(auth),
		product ? stockLevels(db, auth, [product.id]) : null
	]);

	return {
		movements: rows.slice(0, PAGE_SIZE),
		hasMore: rows.length > PAGE_SIZE,
		page,
		reason,
		products,
		product: product ? { ...product, stock: levels?.get(product.id) ?? 0 } : null
	};
};
