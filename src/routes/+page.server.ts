import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.auth) redirect(303, '/dashboard');
	redirect(303, locals.device ? '/pin' : '/login');
};
