import { index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id } from './_shared';
import { branches, tenants } from './tenancy';
import { suppliers, users } from './people';
import { products } from './catalog';

/**
 * Stock received from a supplier (a delivery / goods received note).
 * Like sales, purchases are never edited once saved: each one adds stock movements.
 */
export const purchases = pgTable(
	'purchases',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id),
		supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		/** The supplier's invoice or waybill number. */
		reference: text('reference'),
		/** Total cost in pesewas. */
		total: integer('total').notNull().default(0),
		note: text('note'),
		receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('purchases_tenant_idx').on(t.tenantId, t.receivedAt)]
);

export const purchaseItems = pgTable(
	'purchase_items',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		purchaseId: uuid('purchase_id')
			.notNull()
			.references(() => purchases.id, { onDelete: 'cascade' }),
		productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
		/** Copied at the time, so renaming the product later doesn't change history. */
		name: text('name').notNull(),
		quantity: numeric('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull(),
		unitCost: integer('unit_cost').notNull(),
		lineTotal: integer('line_total').notNull()
	},
	(t) => [index('purchase_items_purchase_idx').on(t.purchaseId)]
);

export const stockTakeStatuses = ['counting', 'completed', 'cancelled'] as const;

/** A physical count of the shelves. When completed, differences become stock movements. */
export const stockTakes = pgTable(
	'stock_takes',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		status: text('status', { enum: stockTakeStatuses }).notNull().default('counting'),
		note: text('note'),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' })
	},
	(t) => [index('stock_takes_tenant_idx').on(t.tenantId, t.startedAt)]
);

export const stockTakeItems = pgTable(
	'stock_take_items',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		stockTakeId: uuid('stock_take_id')
			.notNull()
			.references(() => stockTakes.id, { onDelete: 'cascade' }),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		/** What was on the shelf. Null = not counted yet (left unchanged on completion). */
		countedQty: numeric('counted_qty', { precision: 12, scale: 3, mode: 'number' }),
		/** What the system thought was there when the count was completed. */
		expectedQty: numeric('expected_qty', { precision: 12, scale: 3, mode: 'number' }),
		/** Cost price at completion, used to value the difference. */
		unitCost: integer('unit_cost')
	},
	(t) => [uniqueIndex('stock_take_items_product_idx').on(t.stockTakeId, t.productId)]
);
