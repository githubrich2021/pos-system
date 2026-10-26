import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { getRefund } from '#lib/server/services/refunds.ts';
import { can } from '#lib/core/permissions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const auth = requireUser(locals);
	const refund = await getRefund(auth, params.id);
	// Same rule as receipts: staff who can't see all sales only see refunds on their own sales
	const allowed = refund && (refund.saleUserId === auth.userId || can(auth.permissions, 'sales.refund') || can(auth.permissions, 'reports.view'));
	if (!refund || !allowed) error(404, 'Refund not found.');
	return { refund };
};
