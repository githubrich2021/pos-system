import { fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { hashSecret } from '#lib/server/auth/crypto.ts';
import { audit } from '#lib/server/services/audit.ts';
import { field, isEmail, isPin } from '#lib/server/utils/form.ts';
import { ALL } from '#lib/core/permissions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requirePermission(locals, 'staff.manage');
	const [staff, roles] = await Promise.all([
		db
			.select({
				id: schema.users.id,
				name: schema.users.name,
				email: schema.users.email,
				role: schema.roles.name,
				hasPin: schema.users.pinHash,
				isActive: schema.users.isActive,
				lastLoginAt: schema.users.lastLoginAt
			})
			.from(schema.users)
			.innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
			.where(eq(schema.users.tenantId, auth.tenantId))
			.orderBy(asc(schema.users.name)),
		db.select().from(schema.roles).where(eq(schema.roles.tenantId, auth.tenantId)).orderBy(asc(schema.roles.name))
	]);

	const isOwner = auth.permissions.includes(ALL);
	return {
		staff: staff.map((s) => ({ ...s, hasPin: !!s.hasPin, isSelf: s.id === auth.userId })),
		// Only owners can hand out the Owner role.
		roles: roles.filter((r) => isOwner || !r.permissions.includes(ALL)).map((r) => ({ id: r.id, name: r.name }))
	};
};

async function findStaff(tenantId: string, userId: string) {
	const [row] = await db
		.select({ user: schema.users, role: schema.roles })
		.from(schema.users)
		.innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
		.where(and(eq(schema.users.id, userId), eq(schema.users.tenantId, tenantId)));
	return row;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const auth = requirePermission(locals, 'staff.manage');
		const form = await request.formData();
		const values = {
			name: field(form, 'name'),
			email: field(form, 'email').toLowerCase(),
			roleId: field(form, 'roleId')
		};
		const pin = field(form, 'pin');
		const password = field(form, 'password');

		if (!values.name) return fail(400, { create: values, message: 'Enter a name.' });
		if (pin && !isPin(pin)) return fail(400, { create: values, message: 'PIN must be 4 to 6 digits.' });
		if (values.email && !isEmail(values.email)) return fail(400, { create: values, message: 'Enter a valid email.' });
		if (password && !values.email) return fail(400, { create: values, message: 'Add an email to go with the password.' });
		if (password && password.length < 8) return fail(400, { create: values, message: 'Password must be at least 8 characters.' });
		if (!pin && !password) return fail(400, { create: values, message: 'Give them a PIN, a password, or both.' });

		const [role] = await db
			.select()
			.from(schema.roles)
			.where(and(eq(schema.roles.id, values.roleId), eq(schema.roles.tenantId, auth.tenantId)));
		if (!role) return fail(400, { create: values, message: 'Choose a role.' });
		if (role.permissions.includes(ALL) && !auth.permissions.includes(ALL)) {
			return fail(403, { create: values, message: 'Only an owner can add another owner.' });
		}

		if (values.email) {
			const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, values.email));
			if (taken) return fail(400, { create: values, message: 'That email is already in use.' });
		}

		const [user] = await db
			.insert(schema.users)
			.values({
				tenantId: auth.tenantId,
				roleId: role.id,
				name: values.name,
				email: values.email || null,
				passwordHash: password ? await hashSecret(password) : null,
				pinHash: pin ? await hashSecret(pin) : null
			})
			.returning({ id: schema.users.id });

		await audit(auth, 'staff.created', 'user', user.id, { name: values.name, role: role.name });
		return { created: values.name };
	},

	setPin: async ({ request, locals }) => {
		const auth = requirePermission(locals, 'staff.manage');
		const form = await request.formData();
		const userId = field(form, 'userId');
		const pin = field(form, 'pin');
		if (!isPin(pin)) return fail(400, { pinFor: userId, message: 'PIN must be 4 to 6 digits.' });

		const target = await findStaff(auth.tenantId, userId);
		if (!target) return fail(404, { message: 'Staff member not found.' });
		if (target.role.permissions.includes(ALL) && !auth.permissions.includes(ALL) ) {
			return fail(403, { pinFor: userId, message: "Only an owner can change an owner's PIN." });
		}

		await db.update(schema.users).set({ pinHash: await hashSecret(pin) }).where(eq(schema.users.id, userId));
		await audit(auth, 'staff.pin_changed', 'user', userId);
		return { pinSaved: userId };
	},

	toggleActive: async ({ request, locals }) => {
		const auth = requirePermission(locals, 'staff.manage');
		const form = await request.formData();
		const userId = field(form, 'userId');
		if (userId === auth.userId) return fail(400, { message: "You can't deactivate your own account." });

		const target = await findStaff(auth.tenantId, userId);
		if (!target) return fail(404, { message: 'Staff member not found.' });
		if (target.role.permissions.includes(ALL) && !auth.permissions.includes(ALL)) {
			return fail(403, { message: 'Only an owner can deactivate an owner.' });
		}

		const isActive = !target.user.isActive;
		await db.update(schema.users).set({ isActive }).where(eq(schema.users.id, userId));
		if (!isActive) await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
		await audit(auth, isActive ? 'staff.activated' : 'staff.deactivated', 'user', userId);
		return { ok: true };
	}
};
