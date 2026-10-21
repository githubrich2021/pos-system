import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared';
import { branches, tenants } from './tenancy';

export const roles = pgTable(
	'roles',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		/** Permission keys from src/lib/core/permissions.ts and each module. "*" = everything. */
		permissions: text('permissions').array().notNull().default([]),
		/** Built-in roles (Owner…) can't be deleted. */
		isSystem: boolean('is_system').notNull().default(false),
		...timestamps
	},
	(t) => [uniqueIndex('roles_tenant_name_idx').on(t.tenantId, t.name)]
);

export const users = pgTable(
	'users',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		/** Home branch. Null = can work at any branch. */
		branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
		roleId: uuid('role_id')
			.notNull()
			.references(() => roles.id),
		name: text('name').notNull(),
		/** Owners and managers sign in with email + password from anywhere. */
		email: text('email'),
		passwordHash: text('password_hash'),
		/** Cashiers switch in quickly at a till with a 4–6 digit PIN. */
		pinHash: text('pin_hash'),
		phone: text('phone'),
		isActive: boolean('is_active').notNull().default(true),
		lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		uniqueIndex('users_email_idx').on(t.email),
		index('users_tenant_idx').on(t.tenantId)
	]
);

export const sessions = pgTable(
	'sessions',
	{
		/** SHA-256 of the session token. The raw token only ever lives in the browser cookie. */
		id: text('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		deviceId: uuid('device_id'),
		method: text('method', { enum: ['password', 'pin'] }).notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

/** A till / computer registered to a branch. Staff log in on it with their PIN. */
export const devices = pgTable(
	'devices',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		/** SHA-256 of the device token stored in the till's cookie. */
		tokenHash: text('token_hash').notNull(),
		/** Short code printed on receipts (e.g. "T1"), used in receipt numbers. */
		code: text('code').notNull(),
		receiptCounter: integer('receipt_counter').notNull().default(0),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [uniqueIndex('devices_token_idx').on(t.tokenHash), index('devices_tenant_idx').on(t.tenantId)]
);

export const customers = pgTable(
	'customers',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		phone: text('phone'),
		email: text('email'),
		/** Max amount (pesewas) the customer may owe on credit. 0 = no credit. */
		creditLimit: integer('credit_limit').notNull().default(0),
		loyaltyPoints: integer('loyalty_points').notNull().default(0),
		notes: text('notes'),
		customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
		...timestamps
	},
	(t) => [index('customers_tenant_idx').on(t.tenantId), index('customers_phone_idx').on(t.tenantId, t.phone)]
);

export const suppliers = pgTable(
	'suppliers',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		phone: text('phone'),
		email: text('email'),
		address: text('address'),
		...timestamps
	},
	(t) => [index('suppliers_tenant_idx').on(t.tenantId)]
);
