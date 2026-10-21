import { redirect } from '@sveltejs/kit';
import { destroySession } from '#lib/server/auth/session.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	/** Sign out completely. */
	signout: async ({ cookies }) => {
		await destroySession(cookies);
		redirect(303, '/login');
	},
	/** Lock the till: sign this person out and show the PIN screen for the next cashier. */
	lock: async ({ cookies, locals }) => {
		await destroySession(cookies);
		redirect(303, locals.device ? '/pin' : '/login');
	}
};
