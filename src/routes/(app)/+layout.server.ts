import { requireUser } from '#lib/server/auth/guard.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const auth = requireUser(locals);
	return {
		user: {
			name: auth.name,
			roleName: auth.roleName,
			tenantName: auth.tenantName,
			currency: auth.currency,
			permissions: auth.permissions,
			modules: auth.modules,
			method: auth.method
		},
		device: locals.device ? { name: locals.device.name, code: locals.device.code } : null
	};
};
