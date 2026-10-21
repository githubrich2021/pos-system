import { fail } from '@sveltejs/kit';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { generateToken, sha256 } from '#lib/server/auth/crypto.ts';
import { DEVICE_COOKIE, setDeviceCookie } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/services/audit.ts';
import { field } from '#lib/server/utils/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requirePermission(locals, 'devices.manage');
	const devices = await db
		.select({
			id: schema.devices.id,
			name: schema.devices.name,
			code: schema.devices.code,
			branch: schema.branches.name,
			createdAt: schema.devices.createdAt
		})
		.from(schema.devices)
		.innerJoin(schema.branches, eq(schema.branches.id, schema.devices.branchId))
		.where(and(eq(schema.devices.tenantId, auth.tenantId), isNull(schema.devices.revokedAt)))
		.orderBy(asc(schema.devices.code));

	const current = locals.device?.tenantId === auth.tenantId ? locals.device.id : null;
	return { devices, current };
};

export const actions: Actions = {
	/** Register the browser being used right now as a till for this branch. */
	register: async ({ request, locals, cookies }) => {
		const auth = requirePermission(locals, 'devices.manage');
		const form = await request.formData();
		const name = field(form, 'name') || 'Till';

		const [{ n }] = await db.select({ n: count() }).from(schema.devices).where(eq(schema.devices.tenantId, auth.tenantId));
		const token = generateToken();
		const [device] = await db
			.insert(schema.devices)
			.values({
				tenantId: auth.tenantId,
				branchId: auth.branchId,
				name,
				code: `T${n + 1}`,
				tokenHash: sha256(token)
			})
			.returning();

		setDeviceCookie(cookies, token);
		await audit(auth, 'device.registered', 'device', device.id, { name, code: device.code });
		return { registered: name };
	},

	revoke: async ({ request, locals, cookies }) => {
		const auth = requirePermission(locals, 'devices.manage');
		const form = await request.formData();
		const deviceId = field(form, 'deviceId');

		const [device] = await db
			.update(schema.devices)
			.set({ revokedAt: new Date() })
			.where(and(eq(schema.devices.id, deviceId), eq(schema.devices.tenantId, auth.tenantId)))
			.returning();
		if (!device) return fail(404, { message: 'Device not found.' });

		if (locals.device?.id === deviceId) cookies.delete(DEVICE_COOKIE, { path: '/' });
		await audit(auth, 'device.revoked', 'device', deviceId, { name: device.name });
		return { ok: true };
	}
};
