import { boolean, jsonb, pgTable, primaryKey, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared';

/** A business that subscribes to the POS. Every other table points back here. */
export const tenants = pgTable('tenants', {
	id: id(),
	name: text('name').notNull(),
	currency: text('currency').notNull().default('GHS'),
	country: text('country').notNull().default('GH'),
	timezone: text('timezone').notNull().default('Africa/Accra'),
	phone: text('phone'),
	email: text('email'),
	address: text('address'),
	/** Tax ID / TIN printed on receipts. */
	taxId: text('tax_id'),
	plan: text('plan').notNull().default('trial'),
	trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
	...timestamps
});

/** A shop location. Small businesses have one; chains have several. */
export const branches = pgTable(
	'branches',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		address: text('address'),
		phone: text('phone'),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps
	},
	(t) => [index('branches_tenant_idx').on(t.tenantId)]
);

/** Which business modules (retail, restaurant…) each tenant has switched on. */
export const tenantModules = pgTable(
	'tenant_modules',
	{
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		moduleKey: text('module_key').notNull(),
		enabled: boolean('enabled').notNull().default(true),
		/** Module-specific settings, e.g. { "tablesCount": 12 } for restaurants. */
		settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
		...timestamps
	},
	(t) => [primaryKey({ columns: [t.tenantId, t.moduleKey] })]
);

/**
 * Feature flags let you switch a single feature on for one customer
 * (e.g. a beta, or a paid add-on) without shipping a new release.
 */
export const featureFlags = pgTable(
	'feature_flags',
	{
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		flag: text('flag').notNull(),
		enabled: boolean('enabled').notNull().default(true),
		...timestamps
	},
	(t) => [primaryKey({ columns: [t.tenantId, t.flag] })]
);
