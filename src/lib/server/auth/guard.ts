import { error, redirect } from '@sveltejs/kit';
import { can, type Permission } from '../../core/permissions';
import type { ModuleKey } from '../../core/modules';

/** Use at the top of a load function or action: `const auth = requireUser(locals);` */
export function requireUser(locals: App.Locals) {
	if (!locals.auth) redirect(303, '/login');
	return locals.auth;
}

export function requirePermission(locals: App.Locals, permission: Permission) {
	const auth = requireUser(locals);
	if (!can(auth.permissions, permission)) error(403, 'You do not have permission to do this.');
	return auth;
}

export function requireModule(locals: App.Locals, key: ModuleKey) {
	const auth = requireUser(locals);
	if (!auth.modules.includes(key)) error(404, 'This module is not switched on for your business.');
	return auth;
}
