import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Every record uses a UUID primary key generated on the device that creates it.
 * That lets a till create sales while offline and upload them later without
 * ID clashes or duplicates.
 */
export const id = () => uuid('id').primaryKey().defaultRandom();

export const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};
