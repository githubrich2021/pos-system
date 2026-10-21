import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { verifySecret } from '#lib/server/auth/crypto.ts';
import { createSession } from '#lib/server/auth/session.ts';
import { clearAttempts, tooManyAttempts } from '#lib/server/auth/rate-limit.ts';
import { field } from '#lib/server/utils/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.auth) redirect(303, '/dashboard');
	return { hasDevice: !!locals.device };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const form = await request.formData();
		const email = field(form, 'email').toLowerCase();
		const password = field(form, 'password');

		if (!email || !password) return fail(400, { email, message: 'Enter your email and password.' });

		const limitKey = `login:${getClientAddress()}:${email}`;
		if (tooManyAttempts(limitKey)) {
			return fail(429, { email, message: 'Too many attempts. Wait a few minutes and try again.' });
		}

		const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
		const valid = user?.isActive && (await verifySecret(password, user.passwordHash));
		if (!user || !valid) return fail(400, { email, message: 'Incorrect email or password.' });

		clearAttempts(limitKey);
		await createSession(cookies, user.id, 'password');
		redirect(303, '/dashboard');
	}
};
