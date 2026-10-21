import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { verifySecret } from '#lib/server/auth/crypto.ts';
import { createSession } from '#lib/server/auth/session.ts';
import { clearAttempts, tooManyAttempts } from '#lib/server/auth/rate-limit.ts';
import { field, isPin } from '#lib/server/utils/form.ts';
import type { Actions, PageServerLoad } from './$types';

function staffQuery(device: NonNullable<App.Locals['device']>) {
	return and(
		eq(schema.users.tenantId, device.tenantId),
		eq(schema.users.isActive, true),
		isNotNull(schema.users.pinHash),
		or(isNull(schema.users.branchId), eq(schema.users.branchId, device.branchId))
	);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.device) redirect(303, '/login');
	if (locals.auth) redirect(303, '/dashboard');

	const staff = await db
		.select({ id: schema.users.id, name: schema.users.name, role: schema.roles.name })
		.from(schema.users)
		.innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
		.where(staffQuery(locals.device))
		.orderBy(asc(schema.users.name));

	const [tenant] = await db
		.select({ name: schema.tenants.name })
		.from(schema.tenants)
		.where(eq(schema.tenants.id, locals.device.tenantId));

	return { staff, deviceName: locals.device.name, businessName: tenant?.name ?? '' };
};

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const device = locals.device;
		if (!device) redirect(303, '/login');

		const form = await request.formData();
		const userId = field(form, 'userId');
		const pin = field(form, 'pin');
		if (!userId || !isPin(pin)) return fail(400, { userId, message: 'Enter your 4–6 digit PIN.' });

		const limitKey = `pin:${device.id}:${userId}`;
		if (tooManyAttempts(limitKey)) {
			return fail(429, { userId, message: 'Too many wrong PINs. Ask a manager or wait 5 minutes.' });
		}

		const [user] = await db
			.select()
			.from(schema.users)
			.where(and(eq(schema.users.id, userId), staffQuery(device)))
			.limit(1);

		if (!user || !(await verifySecret(pin, user.pinHash))) {
			return fail(400, { userId, message: 'Wrong PIN. Try again.' });
		}

		clearAttempts(limitKey);
		await createSession(cookies, user.id, 'pin', device.id);
		redirect(303, '/dashboard');
	}
};
