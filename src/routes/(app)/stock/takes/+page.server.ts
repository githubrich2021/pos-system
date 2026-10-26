import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { listStockTakes, startStockTake, StockError } from '#lib/server/services/stock.ts';
import { field } from '#lib/server/utils/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const [takes, categories] = await Promise.all([
		listStockTakes(auth),
		db
			.select({ id: schema.categories.id, name: schema.categories.name })
			.from(schema.categories)
			.where(eq(schema.categories.tenantId, auth.tenantId))
			.orderBy(asc(schema.categories.name))
	]);
	return { takes, categories, inProgress: takes.find((t) => t.status === 'counting') ?? null };
};

export const actions: Actions = {
	start: async ({ locals, request }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const form = await request.formData();
		let id: string;
		try {
			({ id } = await startStockTake(auth, { categoryId: field(form, 'categoryId') || null, note: field(form, 'note') }));
		} catch (e) {
			if (e instanceof StockError) return fail(e.status, { message: e.message });
			throw e;
		}
		redirect(303, `/stock/takes/${id}`);
	}
};
