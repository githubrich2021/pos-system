import { db, schema } from '../db';

export async function audit(
	auth: { tenantId: string; userId: string },
	action: string,
	entity: string,
	entityId?: string | null,
	details: Record<string, unknown> = {}
) {
	await db.insert(schema.auditLog).values({
		tenantId: auth.tenantId,
		userId: auth.userId,
		action,
		entity,
		entityId: entityId ?? null,
		details
	});
}
