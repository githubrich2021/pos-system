import { fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { adjustStock, listStockProducts, StockError } from '#lib/server/services/stock.ts';
import { field } from '#lib/server/utils/form.ts';
import { formatQty } from '#lib/core/stock.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	return { products: await listStockProducts(auth), preselect: url.searchParams.get('product') };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const form = await request.formData();
		try {
			const result = await adjustStock(auth, {
				productId: field(form, 'productId'),
				reason: field(form, 'reason'),
				direction: field(form, 'direction') === 'in' ? 'in' : 'out',
				quantity: Number(field(form, 'quantity')),
				note: field(form, 'note')
			});
			const q = result.movement.quantity;
			return {
				success: `${result.product.name}: ${q > 0 ? '+' : ''}${formatQty(q)} ${result.product.unit}. Now ${formatQty(result.stock)} in stock.`
			};
		} catch (e) {
			if (e instanceof StockError) return fail(e.status, { message: e.message });
			throw e;
		}
	}
};
