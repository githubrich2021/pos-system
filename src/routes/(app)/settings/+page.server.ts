import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/services/audit.ts';
import { field } from '#lib/server/utils/form.ts';
import { can } from '#lib/core/permissions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requireUser(locals);
	if (!can(auth.permissions, 'settings.manage')) {
		redirect(303, can(auth.permissions, 'staff.manage') ? '/settings/staff' : '/settings/device');
	}
	const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, auth.tenantId));
	return { tenant };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const auth = requireUser(locals);
		if (!can(auth.permissions, 'settings.manage')) return fail(403, { message: 'Not allowed.' });

		const form = await request.formData();
		const name = field(form, 'name');
		if (!name) return fail(400, { message: 'Business name is required.' });

		const changes = {
			name,
			phone: field(form, 'phone') || null,
			email: field(form, 'email') || null,
			address: field(form, 'address') || null,
			taxId: field(form, 'taxId') || null
		};
		await db.update(schema.tenants).set(changes).where(eq(schema.tenants.id, auth.tenantId));
		await audit(auth, 'business.updated', 'tenant', auth.tenantId, changes);
		return { saved: true };
	}
};
