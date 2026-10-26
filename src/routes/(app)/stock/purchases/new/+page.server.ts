import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { createPurchase, listStockProducts, StockError, type PurchaseInput } from '#lib/server/services/stock.ts';
import { field } from '#lib/server/utils/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const [products, suppliers] = await Promise.all([
		listStockProducts(auth),
		db
			.select({ id: schema.suppliers.id, name: schema.suppliers.name })
			.from(schema.suppliers)
			.where(eq(schema.suppliers.tenantId, auth.tenantId))
			.orderBy(asc(schema.suppliers.name))
	]);
	return { products, suppliers };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const form = await request.formData();
		let input: PurchaseInput;
		try {
			input = JSON.parse(field(form, 'payload'));
		} catch {
			return fail(400, { message: 'Something went wrong reading the form. Please try again.' });
		}
		let id: string;
		try {
			({ id } = await createPurchase(auth, input));
		} catch (e) {
			if (e instanceof StockError) return fail(e.status, { message: e.message });
			throw e;
		}
		redirect(303, `/stock/purchases/${id}?saved=1`);
	}
};
