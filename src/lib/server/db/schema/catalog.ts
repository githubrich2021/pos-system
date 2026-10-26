import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared';
import { branches, tenants } from './tenancy';
import { users } from './people';

export const categories = pgTable(
	'categories',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		...timestamps
	},
	(t) => [index('categories_tenant_idx').on(t.tenantId)]
);

export const taxRates = pgTable('tax_rates', {
	id: id(),
	tenantId: uuid('tenant_id')
		.notNull()
		.references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	/** Basis points: 1500 = 15%. Integers avoid rounding errors. */
	rateBp: integer('rate_bp').notNull(),
	/** true = shelf price already includes this tax. */
	inclusive: boolean('inclusive').notNull().default(true),
	isActive: boolean('is_active').notNull().default(true),
	...timestamps
});

export const productTypes = ['standard', 'weighed', 'service', 'menu_item'] as const;

export const products = pgTable(
	'products',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
		taxRateId: uuid('tax_rate_id').references(() => taxRates.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		sku: text('sku'),
		barcode: text('barcode'),
		type: text('type', { enum: productTypes }).notNull().default('standard'),
		/** Unit of measure shown on receipts: pcs, kg, litre, box… */
		unit: text('unit').notNull().default('pcs'),
		/** Prices in minor units (pesewas). */
		costPrice: integer('cost_price').notNull().default(0),
		sellPrice: integer('sell_price').notNull(),
		trackStock: boolean('track_stock').notNull().default(true),
		lowStockLevel: numeric('low_stock_level', { precision: 12, scale: 3, mode: 'number' }),
		/** Fields added by modules or the business itself (generic name, kitchen station…). */
		customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps
	},
	(t) => [
		index('products_tenant_idx').on(t.tenantId),
		uniqueIndex('products_tenant_sku_idx').on(t.tenantId, t.sku),
		index('products_barcode_idx').on(t.tenantId, t.barcode)
	]
);

/** Batches with expiry dates — used by the pharmacy module (and food retailers). */
export const stockBatches = pgTable(
	'stock_batches',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id, { onDelete: 'cascade' }),
		batchNo: text('batch_no').notNull(),
		expiryDate: date('expiry_date'),
		...timestamps
	},
	(t) => [index('stock_batches_product_idx').on(t.productId, t.expiryDate)]
);

export const stockReasons = [
	'opening',
	'purchase',
	'sale',
	'refund',
	'adjustment',
	'damage',
	'loss',
	'expired',
	'stock_take',
	'transfer_in',
	'transfer_out'
] as const;

/**
 * Stock is never stored as a single number that gets overwritten.
 * Each change is a movement (+10 purchase, -2 sale…) and the stock level is their sum.
 * This keeps a full history and lets offline tills sync without overwriting each other.
 */
export const stockMovements = pgTable(
	'stock_movements',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id, { onDelete: 'cascade' }),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		batchId: uuid('batch_id').references(() => stockBatches.id, { onDelete: 'set null' }),
		/** Positive adds stock, negative removes it. Decimal for weighed items (1.25 kg). */
		quantity: numeric('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull(),
		reason: text('reason', { enum: stockReasons }).notNull(),
		/** The sale, purchase order or transfer that caused this movement. */
		refId: uuid('ref_id'),
		note: text('note'),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('stock_movements_product_idx').on(t.tenantId, t.branchId, t.productId)]
);
