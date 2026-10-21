import { error, json } from '@sveltejs/kit';
import { createSale, SaleError } from '#lib/server/services/sales.ts';
import type { RequestHandler } from './$types';

/** The till posts finished sales here as JSON. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.auth) error(401, 'Sign in again.');
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid request.');
	}
	try {
		const sale = await createSale(locals.auth, locals.device, body as never);
		return json(sale, { status: sale.duplicate ? 200 : 201 });
	} catch (e) {
		if (e instanceof SaleError) return json({ message: e.message }, { status: e.status });
		throw e;
	}
};
