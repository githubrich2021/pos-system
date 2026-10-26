import { fail } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/services/audit.ts';
import { isUuid } from '#lib/server/services/stock.ts';
import { field, isEmail } from '#lib/server/utils/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const suppliers = await db
		.select({
			id: schema.suppliers.id,
			name: schema.suppliers.name,
			phone: schema.suppliers.phone,
			email: schema.suppliers.email,
			address: schema.suppliers.address,
			deliveries: sql<number>`count(${schema.purchases.id})`.mapWith(Number),
			totalBought: sql<number>`coalesce(sum(${schema.purchases.total}), 0)`.mapWith(Number),
			lastDelivery: sql<string | null>`max(${schema.purchases.receivedAt})`
		})
		.from(schema.suppliers)
		.leftJoin(schema.purchases, eq(schema.purchases.supplierId, schema.suppliers.id))
		.where(eq(schema.suppliers.tenantId, auth.tenantId))
		.groupBy(schema.suppliers.id)
		.orderBy(asc(schema.suppliers.name));
	return { suppliers };
};

function readSupplier(form: FormData) {
	const values = {
		name: field(form, 'name').slice(0, 120),
		phone: field(form, 'phone').slice(0, 40) || null,
		email: field(form, 'email').slice(0, 120) || null,
		address: field(form, 'address').slice(0, 300) || null
	};
	if (!values.name) return { error: "Enter the supplier's name." };
	if (values.email && !isEmail(values.email)) return { error: 'Enter a valid email address.' };
	return { values };
}

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const { values, error } = readSupplier(await request.formData());
		if (!values) return fail(400, { message: error });
		const [s] = await db.insert(schema.suppliers).values({ tenantId: auth.tenantId, ...values }).returning();
		await audit(auth, 'supplier.created', 'supplier', s.id, { name: s.name });
		return { success: `${s.name} added.` };
	},
	update: async ({ locals, request }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const form = await request.formData();
		const id = field(form, 'id');
		if (!isUuid(id)) return fail(400, { message: 'Supplier not found.' });
		const { values, error } = readSupplier(form);
		if (!values) return fail(400, { message: error });
		const [s] = await db
			.update(schema.suppliers)
			.set(values)
			.where(and(eq(schema.suppliers.id, id), eq(schema.suppliers.tenantId, auth.tenantId)))
			.returning();
		if (!s) return fail(404, { message: 'Supplier not found.' });
		await audit(auth, 'supplier.updated', 'supplier', s.id, values);
		return { success: `${s.name} saved.` };
	}
};
