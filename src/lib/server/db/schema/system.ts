import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './_shared';
import { tenants } from './tenancy';
import { users } from './people';

/**
 * Who did what, when. Every void, refund, price change, stock adjustment
 * and settings change writes a row here. Rows are never edited or deleted.
 */
export const auditLog = pgTable(
	'audit_log',
	{
		id: id(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action').notNull(),
		entity: text('entity').notNull(),
		entityId: text('entity_id'),
		details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('audit_tenant_idx').on(t.tenantId, t.createdAt)]
);
