import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { createCustomer, CustomerError, listCustomers, totalOwed } from '#lib/server/services/customers.ts';
import { field } from '#lib/server/utils/form.ts';
import { can } from '#lib/core/permissions.ts';
import { toMinor } from '#lib/core/money.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requirePermission(locals, 'customers.manage');
	const q = url.searchParams.get('q')?.trim() ?? '';
	const owing = url.searchParams.get('show') === 'owing';
	const [customers, owed] = await Promise.all([listCustomers(auth, { q, owing }), totalOwed(auth)]);
	return { customers, owed, q, owing, canSetCredit: can(auth.permissions, 'customers.credit') };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const auth = requirePermission(locals, 'customers.manage');
		const form = await request.formData();
		const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
		const limit = field(form, 'creditLimit');
		let id: string;
		try {
			if (limit && !Number.isFinite(Number(limit))) throw new CustomerError('Enter a valid credit limit.');
			({ id } = await createCustomer(auth, {
				name: field(form, 'name'),
				phone: field(form, 'phone'),
				email: field(form, 'email'),
				notes: field(form, 'notes'),
				creditLimit: limit ? toMinor(limit) : undefined
			}));
		} catch (e) {
			if (e instanceof CustomerError) return fail(e.status, { message: e.message, values });
			throw e;
		}
		redirect(303, `/customers/${id}`);
	}
};
