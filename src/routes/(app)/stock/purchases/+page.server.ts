import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const purchases = await db
		.select({
			id: schema.purchases.id,
			reference: schema.purchases.reference,
			total: schema.purchases.total,
			receivedAt: schema.purchases.receivedAt,
			supplier: schema.suppliers.name,
			receivedBy: schema.users.name,
			lines: sql<number>`(select count(*) from ${schema.purchaseItems} where ${schema.purchaseItems.purchaseId} = ${schema.purchases.id})`.mapWith(Number)
		})
		.from(schema.purchases)
		.leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.purchases.supplierId))
		.leftJoin(schema.users, eq(schema.users.id, schema.purchases.userId))
		.where(and(eq(schema.purchases.tenantId, auth.tenantId), eq(schema.purchases.branchId, auth.branchId)))
		.orderBy(desc(schema.purchases.receivedAt))
		.limit(100);
	return { purchases };
};
