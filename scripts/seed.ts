/**
 * Creates a demo business with products and staff so you can try the app.
 *   npm run db:seed
 *
 * Sign in:  owner@demo.test / demo1234
 * Till PINs: Ama (Cashier) 1111, Kofi (Manager) 2222
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema/index.ts';
import { createBusiness } from '../src/lib/server/services/business.ts';
import { hashSecret } from '../src/lib/server/auth/crypto.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (check your .env file)');

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const EMAIL = 'owner@demo.test';

const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, EMAIL));
if (existing) {
	console.log(`Demo business already exists — sign in with ${EMAIL} / demo1234`);
	await client.end();
	process.exit(0);
}

const { tenant, branch, owner, roles } = await createBusiness(db, {
	businessName: 'Demo Mart',
	ownerName: 'Demo Owner',
	email: EMAIL,
	password: 'demo1234',
	phone: '0240000000',
	modules: ['retail', 'pharmacy']
});

const role = (name: string) => roles.find((r) => r.name === name)!.id;
await db.insert(schema.users).values([
	{ tenantId: tenant.id, roleId: role('Cashier'), name: 'Ama Mensah', pinHash: await hashSecret('1111') },
	{ tenantId: tenant.id, roleId: role('Manager'), name: 'Kofi Boateng', pinHash: await hashSecret('2222') }
]);
await db.update(schema.users).set({ pinHash: await hashSecret('9999') }).where(eq(schema.users.id, owner.id));

const [vat] = await db.select().from(schema.taxRates).where(eq(schema.taxRates.tenantId, tenant.id));

const cats = await db
	.insert(schema.categories)
	.values(['Drinks', 'Groceries', 'Toiletries', 'Medicines'].map((name) => ({ tenantId: tenant.id, name })))
	.returning();
const cat = (name: string) => cats.find((c) => c.name === name)!.id;

// [name, category, sku, barcode, unit, sell (GHS), cost (GHS), stock, low]
const items: [string, string, string, string, string, number, number, number, number][] = [
	['Coca-Cola 500ml', 'Drinks', 'DRK-001', '5449000000996', 'bottle', 8, 6, 48, 12],
	['Voltic Water 750ml', 'Drinks', 'DRK-002', '6034000100015', 'bottle', 4, 2.8, 120, 24],
	['Milo 400g', 'Groceries', 'GRO-001', '6001068322007', 'pcs', 45, 38, 15, 5],
	['Frytol Oil 1L', 'Groceries', 'GRO-002', '6034000200012', 'bottle', 38, 31, 6, 8],
	['Rice (loose)', 'Groceries', 'GRO-003', '', 'kg', 18, 14, 50, 10],
	['Key Soap', 'Toiletries', 'TOI-001', '6034000300019', 'pcs', 7, 5, 60, 15],
	['Pepsodent 140g', 'Toiletries', 'TOI-002', '8714789946398', 'pcs', 22, 17, 3, 6],
	['Paracetamol 500mg (strip)', 'Medicines', 'MED-001', '6034000400016', 'pack', 5, 2.5, 80, 20]
];

for (const [name, category, sku, barcode, unit, sell, cost, stock, low] of items) {
	const [p] = await db
		.insert(schema.products)
		.values({
			tenantId: tenant.id,
			categoryId: cat(category),
			taxRateId: vat?.id,
			name,
			sku,
			barcode: barcode || null,
			type: unit === 'kg' ? 'weighed' : 'standard',
			unit,
			sellPrice: Math.round(sell * 100),
			costPrice: Math.round(cost * 100),
			lowStockLevel: low,
			customFields: category === 'Medicines' ? { generic_name: 'Paracetamol', requires_prescription: false } : {}
		})
		.returning();
	await db.insert(schema.stockMovements).values({
		tenantId: tenant.id,
		branchId: branch.id,
		productId: p.id,
		quantity: stock,
		reason: 'opening',
		userId: owner.id
	});
}

console.log(`Created "${tenant.name}" with ${items.length} products.`);
console.log(`  Sign in:   ${EMAIL} / demo1234`);
console.log('  Till PINs: Demo Owner 9999 · Ama (Cashier) 1111 · Kofi (Manager) 2222');
await client.end();
