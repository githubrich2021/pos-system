import { error, fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { getSaleDetail, SaleError, voidSale } from '#lib/server/services/sales.ts';
import { field } from '#lib/server/utils/form.ts';
import { can } from '#lib/core/permissions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const auth = requireUser(locals);
	const sale = await getSaleDetail(auth, params.id);
	if (!sale) error(404, 'Sale not found.');
	return { sale, canVoid: can(auth.permissions, 'sales.void') };
};

export const actions: Actions = {
	void: async ({ locals, params, request }) => {
		const auth = requireUser(locals);
		const form = await request.formData();
		try {
			await voidSale(auth, params.id, field(form, 'reason'));
		} catch (e) {
			if (e instanceof SaleError) return fail(e.status, { message: e.message });
			throw e;
		}
		return { voided: true };
	}
};
