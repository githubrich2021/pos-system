import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import {
	customerStatement,
	CustomerError,
	getCustomer,
	recordRepayment,
	updateCustomer,
	voidRepayment
} from '#lib/server/services/customers.ts';
import { getOpenShift } from '#lib/server/services/sales.ts';
import { field } from '#lib/server/utils/form.ts';
import { can } from '#lib/core/permissions.ts';
import { toMinor } from '#lib/core/money.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const auth = requirePermission(locals, 'customers.manage');
	const customer = await getCustomer(auth, params.id);
	if (!customer) error(404, 'Customer not found.');
	const [statement, shift] = await Promise.all([customerStatement(auth, customer.id), getOpenShift(auth)]);
	return {
		customer,
		statement,
		hasShift: !!shift,
		canSetCredit: can(auth.permissions, 'customers.credit'),
		canVoid: can(auth.permissions, 'sales.void')
	};
};

async function attempt<T>(fn: () => Promise<T>) {
	try {
		return { ok: true as const, value: await fn() };
	} catch (e) {
		if (e instanceof CustomerError) return { ok: false as const, error: fail(e.status, { message: e.message }) };
		throw e;
	}
}

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		const auth = requirePermission(locals, 'customers.manage');
		const form = await request.formData();
		const limit = field(form, 'creditLimit');
		if (limit && !Number.isFinite(Number(limit))) return fail(400, { message: 'Enter a valid credit limit.' });
		const r = await attempt(() =>
			updateCustomer(auth, params.id, {
				name: field(form, 'name'),
				phone: field(form, 'phone'),
				email: field(form, 'email'),
				notes: field(form, 'notes'),
				creditLimit: form.has('creditLimit') ? toMinor(limit || '0') : undefined
			})
		);
		if (!r.ok) return r.error;
		return { updated: true };
	},

	pay: async ({ locals, params, request }) => {
		const auth = requirePermission(locals, 'customers.manage');
		const form = await request.formData();
		const raw = field(form, 'amount');
		if (!raw || !Number.isFinite(Number(raw))) return fail(400, { message: 'Enter the amount they paid.' });
		const r = await attempt(() =>
			recordRepayment(auth, params.id, {
				id: field(form, 'id'),
				method: field(form, 'method'),
				amount: toMinor(raw),
				reference: field(form, 'reference'),
				note: field(form, 'note')
			})
		);
		if (!r.ok) return r.error;
		return { paid: { id: r.value.id } };
	},

	voidPayment: async ({ locals, request }) => {
		const auth = requirePermission(locals, 'customers.manage');
		const form = await request.formData();
		const r = await attempt(() => voidRepayment(auth, field(form, 'paymentId'), field(form, 'reason')));
		if (!r.ok) return r.error;
		return { voided: true };
	}
};
