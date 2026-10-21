import { fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { BusinessError, createBusiness } from '#lib/server/services/business.ts';
import { createSession } from '#lib/server/auth/session.ts';
import { field, isEmail } from '#lib/server/utils/form.ts';
import { isModuleKey } from '#lib/modules/index.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.auth) redirect(303, '/dashboard');
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const values = {
			businessName: field(form, 'businessName'),
			ownerName: field(form, 'ownerName'),
			email: field(form, 'email').toLowerCase(),
			phone: field(form, 'phone'),
			modules: form.getAll('modules').map(String).filter(isModuleKey)
		};
		const password = field(form, 'password');

		if (!values.businessName || !values.ownerName) return fail(400, { ...values, message: 'Enter the business and owner names.' });
		if (!isEmail(values.email)) return fail(400, { ...values, message: 'Enter a valid email address.' });
		if (password.length < 8) return fail(400, { ...values, message: 'Password must be at least 8 characters.' });
		if (!values.modules.length) return fail(400, { ...values, message: 'Choose at least one business type.' });

		try {
			const { owner } = await createBusiness(db, { ...values, password });
			await createSession(cookies, owner.id, 'password');
		} catch (e) {
			if (e instanceof BusinessError) return fail(400, { ...values, message: e.message });
			throw e;
		}
		redirect(303, '/dashboard?welcome=1');
	}
};
