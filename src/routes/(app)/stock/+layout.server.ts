import { requirePermission } from '#lib/server/auth/guard.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	requirePermission(locals, 'stock.adjust');
	return {};
};
