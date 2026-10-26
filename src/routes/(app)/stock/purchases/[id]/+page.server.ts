import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { getPurchase } from '#lib/server/services/stock.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const purchase = await getPurchase(auth, params.id);
	if (!purchase) error(404, 'Delivery not found.');
	return { purchase, saved: url.searchParams.has('saved') };
};
