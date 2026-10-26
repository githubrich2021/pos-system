import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { getRepayment } from '#lib/server/services/customers.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const auth = requirePermission(locals, 'customers.manage');
	const payment = await getRepayment(auth, params.id);
	if (!payment) error(404, 'Payment not found.');
	return { payment };
};
