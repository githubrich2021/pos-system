import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { getSaleDetail } from '#lib/server/services/sales.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const auth = requireUser(locals);
	const sale = await getSaleDetail(auth, params.id);
	if (!sale) error(404, 'Receipt not found.');
	return { sale };
};
