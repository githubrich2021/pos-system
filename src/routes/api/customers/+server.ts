import { error, json } from '@sveltejs/kit';
import { can } from '#lib/core/permissions.ts';
import { createCustomer, CustomerError, listCustomers } from '#lib/server/services/customers.ts';
import type { RequestHandler } from './$types';

/** Till customer search: by name or phone. */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.auth) error(401, 'Sign in again.');
	if (!can(locals.auth.permissions, 'sales.create') && !can(locals.auth.permissions, 'customers.manage')) error(403, 'Not allowed.');
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) return json([]);
	const rows = await listCustomers(locals.auth, { q, limit: 8 });
	return json(rows.map((c) => ({ ...c, available: Math.max(0, c.creditLimit - c.balance) })));
};

/** Quick-add a customer from the till (name and phone). */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.auth) error(401, 'Sign in again.');
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid request.');
	try {
		const c = await createCustomer(locals.auth, { name: String(body.name ?? ''), phone: String(body.phone ?? '') });
		return json({ id: c.id, name: c.name, phone: c.phone, email: c.email, creditLimit: c.creditLimit, balance: 0, available: c.creditLimit }, { status: 201 });
	} catch (e) {
		if (e instanceof CustomerError) return json({ message: e.message }, { status: e.status });
		throw e;
	}
};
