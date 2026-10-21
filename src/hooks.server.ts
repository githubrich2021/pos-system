import type { Handle } from '@sveltejs/kit/hooks';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import {
	DEVICE_COOKIE,
	SESSION_COOKIE,
	validateDevice,
	validateSession
} from '#lib/server/auth/session.ts';
import { isModuleKey } from '#lib/modules/index.ts';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.auth = null;
	event.locals.device = null;

	const deviceToken = event.cookies.get(DEVICE_COOKIE);
	if (deviceToken) {
		const device = await validateDevice(deviceToken);
		if (device) {
			event.locals.device = {
				id: device.id,
				tenantId: device.tenantId,
				branchId: device.branchId,
				name: device.name,
				code: device.code
			};
		}
	}

	const sessionToken = event.cookies.get(SESSION_COOKIE);
	if (sessionToken) {
		const row = await validateSession(sessionToken);
		if (row) {
			const { session, user, role, tenant } = row;

			const moduleRows = await db
				.select({ key: schema.tenantModules.moduleKey })
				.from(schema.tenantModules)
				.where(and(eq(schema.tenantModules.tenantId, tenant.id), eq(schema.tenantModules.enabled, true)));

			// Branch: the till's branch, else the user's home branch, else the first branch.
			const device = event.locals.device?.tenantId === tenant.id ? event.locals.device : null;
			let branchId = device?.branchId ?? user.branchId;
			if (!branchId) {
				const [first] = await db
					.select({ id: schema.branches.id })
					.from(schema.branches)
					.where(eq(schema.branches.tenantId, tenant.id))
					.orderBy(asc(schema.branches.createdAt))
					.limit(1);
				branchId = first?.id;
			}

			event.locals.auth = {
				userId: user.id,
				name: user.name,
				email: user.email,
				roleName: role.name,
				permissions: role.permissions,
				tenantId: tenant.id,
				tenantName: tenant.name,
				currency: tenant.currency,
				branchId: branchId!,
				modules: moduleRows.map((m) => m.key).filter(isModuleKey),
				method: session.method
			};
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	return resolve(event);
};
