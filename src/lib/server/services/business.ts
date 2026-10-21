import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import { DEFAULT_ROLES } from '../../core/permissions';
import { DEFAULT_MODULE_KEYS } from '../../core/modules';
import { hashSecret } from '../auth/crypto';

type Db = PostgresJsDatabase<typeof schema>;

export interface NewBusiness {
	businessName: string;
	ownerName: string;
	email: string;
	password: string;
	phone?: string;
	/** Modules to switch on. Defaults to DEFAULT_MODULE_KEYS (retail). */
	modules?: string[];
}

/**
 * Sign up a new business: creates the tenant, a main branch, the default roles,
 * the owner account, VAT settings and the chosen modules — all in one transaction.
 */
export async function createBusiness(db: Db, input: NewBusiness) {
	const email = input.email.trim().toLowerCase();
	const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
	if (existing) throw new BusinessError('An account with this email already exists.');

	return db.transaction(async (tx) => {
		const [tenant] = await tx
			.insert(schema.tenants)
			.values({
				name: input.businessName.trim(),
				email,
				phone: input.phone,
				trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			})
			.returning();

		const [branch] = await tx
			.insert(schema.branches)
			.values({ tenantId: tenant.id, name: 'Main branch' })
			.returning();

		const roles = await tx
			.insert(schema.roles)
			.values(DEFAULT_ROLES.map((r) => ({ tenantId: tenant.id, name: r.name, permissions: r.permissions, isSystem: true })))
			.returning();
		const ownerRole = roles.find((r) => r.name === 'Owner')!;

		const [owner] = await tx
			.insert(schema.users)
			.values({
				tenantId: tenant.id,
				roleId: ownerRole.id,
				name: input.ownerName.trim(),
				email,
				phone: input.phone,
				passwordHash: await hashSecret(input.password)
			})
			.returning();

		const moduleKeys = input.modules?.length ? input.modules : DEFAULT_MODULE_KEYS;
		await tx
			.insert(schema.tenantModules)
			.values(moduleKeys.map((moduleKey) => ({ tenantId: tenant.id, moduleKey, enabled: true })));

		// Placeholder rate — confirm current GRA VAT and levies before going live.
		await tx.insert(schema.taxRates).values({ tenantId: tenant.id, name: 'VAT', rateBp: 1500, inclusive: true });

		await tx.insert(schema.auditLog).values({
			tenantId: tenant.id,
			userId: owner.id,
			action: 'business.created',
			entity: 'tenant',
			entityId: tenant.id,
			details: { modules: moduleKeys }
		});

		return { tenant, branch, owner, roles };
	});
}

export class BusinessError extends Error {}
