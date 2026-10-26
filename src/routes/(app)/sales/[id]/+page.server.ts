import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { getOpenShift, getSaleDetail, SaleError, voidSale } from '#lib/server/services/sales.ts';
import { createRefund, RefundError, refundableLines, refundsForSale, type RefundInput } from '#lib/server/services/refunds.ts';
import { customerBalances } from '#lib/server/services/customers.ts';
import { field } from '#lib/server/utils/form.ts';
import { can } from '#lib/core/permissions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const auth = requireUser(locals);
	const sale = await getSaleDetail(auth, params.id);
	if (!sale) error(404, 'Sale not found.');

	const canRefund = can(auth.permissions, 'sales.refund');
	const [refunds, refundable, shift, balances] = await Promise.all([
		refundsForSale(auth, sale.sale.id),
		canRefund ? refundableLines(db, sale.sale.id) : null,
		canRefund ? getOpenShift(auth) : null,
		sale.sale.customerId ? customerBalances(db, auth.tenantId, [sale.sale.customerId]) : null
	]);

	return {
		sale,
		refunds,
		refundable,
		hasShift: !!shift,
		customer: sale.customer && sale.sale.customerId ? { name: sale.customer, balance: balances?.get(sale.sale.customerId) ?? 0 } : null,
		canVoid: can(auth.permissions, 'sales.void'),
		canRefund
	};
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
	},

	refund: async ({ locals, params, request }) => {
		const auth = requireUser(locals);
		const form = await request.formData();
		let input: RefundInput;
		try {
			input = JSON.parse(field(form, 'payload'));
		} catch {
			return fail(400, { message: 'Something went wrong reading the refund. Please try again.' });
		}
		try {
			const r = await createRefund(auth, params.id, input);
			return { refunded: { id: r.id } };
		} catch (e) {
			if (e instanceof RefundError) return fail(e.status, { message: e.message });
			throw e;
		}
	}
};
