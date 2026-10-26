import { boolean, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id } from './_shared';
import { branches, tenants } from './tenancy';
import { customers, devices, users } from './people';
import { products, stockBatches } from './catalog';

export const shifts = pgTable(
	'shifts',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id),
		deviceId: uuid('device_id').references(() => devices.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		openingCash: integer('opening_cash').notNull().default(0),
		/** Cash counted in the drawer at close. */
		countedCash: integer('counted_cash'),
		/** What the system expected in the drawer at close. Difference = over/short. */
		expectedCash: integer('expected_cash'),
		closingNote: text('closing_note'),
		openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
		closedAt: timestamp('closed_at', { withTimezone: true })
	},
	(t) => [index('shifts_tenant_idx').on(t.tenantId, t.openedAt), index('shifts_user_idx').on(t.userId, t.closedAt)]
);

export const saleStatuses = ['completed', 'held', 'refunded', 'partially_refunded', 'voided'] as const;

/**
 * Sales are append-only: once completed they are never edited.
 * Mistakes are fixed with a refund or void, which keeps the audit trail honest
 * and avoids sync conflicts between offline tills.
 */
export const sales = pgTable(
	'sales',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id),
		deviceId: uuid('device_id').references(() => devices.id),
		shiftId: uuid('shift_id').references(() => shifts.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		customerId: uuid('customer_id').references(() => customers.id),
		/** Human-readable number, unique per tenant: T1-000042. */
		receiptNo: text('receipt_no').notNull(),
		status: text('status', { enum: saleStatuses }).notNull().default('completed'),
		/** Module that created the sale (restaurant orders, salon bookings…). */
		source: text('source').notNull().default('retail'),
		subtotal: integer('subtotal').notNull(),
		discountTotal: integer('discount_total').notNull().default(0),
		taxTotal: integer('tax_total').notNull().default(0),
		total: integer('total').notNull(),
		/** Cash handed over by the customer and change given back (for the receipt). */
		cashTendered: integer('cash_tendered').notNull().default(0),
		changeGiven: integer('change_given').notNull().default(0),
		note: text('note'),
		voidedAt: timestamp('voided_at', { withTimezone: true }),
		voidedBy: uuid('voided_by').references(() => users.id),
		voidReason: text('void_reason'),
		/** When the sale was made on the till (may be earlier than createdAt if it was offline). */
		soldAt: timestamp('sold_at', { withTimezone: true }).notNull().defaultNow(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('sales_shift_idx').on(t.shiftId),
		uniqueIndex('sales_receipt_idx').on(t.tenantId, t.receiptNo),
		index('sales_tenant_date_idx').on(t.tenantId, t.soldAt)
	]
);

export const saleItems = pgTable(
	'sale_items',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		saleId: uuid('sale_id')
			.notNull()
			.references(() => sales.id, { onDelete: 'cascade' }),
		productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
		batchId: uuid('batch_id').references(() => stockBatches.id, { onDelete: 'set null' }),
		/** Name and prices copied at sale time, so later price changes don't rewrite history. */
		name: text('name').notNull(),
		quantity: numeric('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull(),
		unitPrice: integer('unit_price').notNull(),
		costPrice: integer('cost_price').notNull().default(0),
		discount: integer('discount').notNull().default(0),
		tax: integer('tax').notNull().default(0),
		lineTotal: integer('line_total').notNull()
	},
	(t) => [index('sale_items_sale_idx').on(t.saleId)]
);

export const paymentMethods = ['cash', 'momo', 'card', 'credit', 'bank', 'other'] as const;

export const payments = pgTable(
	'payments',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		saleId: uuid('sale_id')
			.notNull()
			.references(() => sales.id, { onDelete: 'cascade' }),
		method: text('method', { enum: paymentMethods }).notNull(),
		amount: integer('amount').notNull(),
		/** MoMo transaction ID, card approval code, etc. */
		reference: text('reference'),
		/** Payment provider used, e.g. "paystack", "hubtel", or "manual". */
		provider: text('provider').notNull().default('manual'),
		status: text('status', { enum: ['pending', 'paid', 'failed', 'refunded'] })
			.notNull()
			.default('paid'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('payments_sale_idx').on(t.saleId)]
);

export const expenses = pgTable(
	'expenses',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id),
		userId: uuid('user_id').references(() => users.id),
		category: text('category').notNull(),
		amount: integer('amount').notNull(),
		note: text('note'),
		spentAt: timestamp('spent_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('expenses_tenant_idx').on(t.tenantId, t.spentAt)]
);

export const repaymentMethods = ['cash', 'momo', 'card', 'bank'] as const;

/**
 * Money a customer pays towards what they owe from "pay later" sales.
 * What a customer owes = credit payments on their completed sales − these repayments.
 * Rows are never edited; a mistake is voided with a reason.
 */
export const customerPayments = pgTable(
	'customer_payments',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		customerId: uuid('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id),
		/** The shift it was taken in, so cash repayments count towards the drawer. */
		shiftId: uuid('shift_id').references(() => shifts.id),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		method: text('method', { enum: repaymentMethods }).notNull(),
		amount: integer('amount').notNull(),
		reference: text('reference'),
		note: text('note'),
		voidedAt: timestamp('voided_at', { withTimezone: true }),
		voidedBy: uuid('voided_by').references(() => users.id, { onDelete: 'set null' }),
		voidReason: text('void_reason'),
		paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('customer_payments_customer_idx').on(t.customerId, t.paidAt), index('customer_payments_shift_idx').on(t.shiftId)]
);

/** Sales that still count as sales (a voided sale doesn't). Refunds are subtracted separately. */
export const countedSaleStatuses = ['completed', 'partially_refunded', 'refunded'] as const;

/**
 * How refund money went back: paid out, or taken off what the customer owes ("account").
 */
export const refundMethods = ['cash', 'momo', 'card', 'bank', 'account'] as const;

/**
 * Money and items returned against a sale. A sale can have several refunds (partial returns).
 * Like sales, refunds are never edited.
 */
export const refunds = pgTable(
	'refunds',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id),
		saleId: uuid('sale_id')
			.notNull()
			.references(() => sales.id, { onDelete: 'cascade' }),
		/** The shift the money left from, so cash refunds come off the drawer. */
		shiftId: uuid('shift_id').references(() => shifts.id),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		method: text('method', { enum: refundMethods }).notNull(),
		/** Total given back, in pesewas. */
		amount: integer('amount').notNull(),
		/** VAT included in the amount, so tax reports can be corrected. */
		tax: integer('tax').notNull().default(0),
		reference: text('reference'),
		reason: text('reason').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('refunds_sale_idx').on(t.saleId), index('refunds_tenant_idx').on(t.tenantId, t.createdAt), index('refunds_shift_idx').on(t.shiftId)]
);

export const refundItems = pgTable(
	'refund_items',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		refundId: uuid('refund_id')
			.notNull()
			.references(() => refunds.id, { onDelete: 'cascade' }),
		saleItemId: uuid('sale_item_id')
			.notNull()
			.references(() => saleItems.id, { onDelete: 'cascade' }),
		productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
		name: text('name').notNull(),
		quantity: numeric('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull(),
		amount: integer('amount').notNull(),
		tax: integer('tax').notNull().default(0),
		/** false = the item was damaged or thrown away, so it did not go back into stock. */
		restocked: boolean('restocked').notNull()
	},
	(t) => [index('refund_items_refund_idx').on(t.refundId), index('refund_items_sale_item_idx').on(t.saleItemId)]
);
