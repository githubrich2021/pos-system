import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/services/audit.ts';
import { checkbox, field } from '#lib/server/utils/form.ts';
import { toMinor } from '#lib/core/money.ts';
import { enabledModules } from '#lib/modules/index.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requirePermission(locals, 'products.manage');
	const [categories, taxRates] = await Promise.all([
		db.select({ name: schema.categories.name }).from(schema.categories).where(eq(schema.categories.tenantId, auth.tenantId)).orderBy(asc(schema.categories.name)),
		db.select({ id: schema.taxRates.id, name: schema.taxRates.name, rateBp: schema.taxRates.rateBp }).from(schema.taxRates).where(and(eq(schema.taxRates.tenantId, auth.tenantId), eq(schema.taxRates.isActive, true)))
	]);
	return { categories: categories.map((c) => c.name), taxRates };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const auth = requirePermission(locals, 'products.manage');
		const form = await request.formData();
		const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

		const name = field(form, 'name');
		const sellPrice = Number(field(form, 'sellPrice'));
		const costPrice = Number(field(form, 'costPrice') || 0);
		const openingStock = Number(field(form, 'openingStock') || 0);
		const lowStock = field(form, 'lowStockLevel');

		if (!name) return fail(400, { values, message: 'Enter a product name.' });
		if (!Number.isFinite(sellPrice) || sellPrice < 0) return fail(400, { values, message: 'Enter a valid selling price.' });
		if (!Number.isFinite(costPrice) || costPrice < 0) return fail(400, { values, message: 'Enter a valid cost price.' });
		if (!Number.isFinite(openingStock)) return fail(400, { values, message: 'Enter a valid opening stock.' });

		// Fields added by switched-on modules (generic name, kitchen station…)
		const customFields: Record<string, unknown> = {};
		for (const f of enabledModules(auth.modules).flatMap((m) => m.productFields)) {
			const raw = field(form, `cf_${f.key}`);
			if (f.type === 'boolean') customFields[f.key] = checkbox(form, `cf_${f.key}`);
			else if (raw) {
				const n = Number(raw);
				if ((f.type === 'number' || f.type === 'money') && !Number.isFinite(n)) {
					return fail(400, { values, message: `Enter a valid number for ${f.label}.` });
				}
				customFields[f.key] = f.type === 'money' ? toMinor(n) : f.type === 'number' ? n : raw;
			}
		}

		const sku = field(form, 'sku') || null;
		if (sku) {
			const [dupe] = await db
				.select({ id: schema.products.id })
				.from(schema.products)
				.where(and(eq(schema.products.tenantId, auth.tenantId), eq(schema.products.sku, sku)));
			if (dupe) return fail(400, { values, message: `Another product already uses SKU ${sku}.` });
		}

		const product = await db.transaction(async (tx) => {
			let categoryId: string | null = null;
			const categoryName = field(form, 'category');
			if (categoryName) {
				const [existing] = await tx
					.select({ id: schema.categories.id })
					.from(schema.categories)
					.where(and(eq(schema.categories.tenantId, auth.tenantId), eq(schema.categories.name, categoryName)));
				categoryId =
					existing?.id ??
					(await tx.insert(schema.categories).values({ tenantId: auth.tenantId, name: categoryName }).returning())[0].id;
			}

			const [product] = await tx
				.insert(schema.products)
				.values({
					tenantId: auth.tenantId,
					categoryId,
					taxRateId: field(form, 'taxRateId') || null,
					name,
					sku,
					barcode: field(form, 'barcode') || null,
					unit: field(form, 'unit') || 'pcs',
					sellPrice: toMinor(sellPrice),
					costPrice: toMinor(costPrice),
					trackStock: checkbox(form, 'trackStock'),
					lowStockLevel: lowStock ? Number(lowStock) : null,
					customFields
				})
				.returning();

			if (openingStock !== 0 && product.trackStock) {
				await tx.insert(schema.stockMovements).values({
					tenantId: auth.tenantId,
					branchId: auth.branchId,
					productId: product.id,
					quantity: openingStock,
					reason: 'opening',
					userId: auth.userId
				});
			}
			return product;
		});

		await audit(auth, 'product.created', 'product', product.id, { name, sellPrice: product.sellPrice, openingStock });
		redirect(303, '/products');
	}
};
