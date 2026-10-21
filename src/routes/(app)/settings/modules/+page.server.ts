import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/services/audit.ts';
import { checkbox, field } from '#lib/server/utils/form.ts';
import { isModuleKey } from '#lib/modules/index.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals, 'settings.manage');
};

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		const auth = requirePermission(locals, 'settings.manage');
		const form = await request.formData();
		const key = field(form, 'key');
		const enable = checkbox(form, 'enable');

		if (!isModuleKey(key)) return fail(400, { message: 'Unknown module.' });
		if (!enable && auth.modules.length === 1 && auth.modules[0] === key) {
			return fail(400, { message: 'Keep at least one business module switched on.' });
		}

		await db
			.insert(schema.tenantModules)
			.values({ tenantId: auth.tenantId, moduleKey: key, enabled: enable })
			.onConflictDoUpdate({
				target: [schema.tenantModules.tenantId, schema.tenantModules.moduleKey],
				set: { enabled: enable, updatedAt: new Date() }
			});
		await audit(auth, enable ? 'module.enabled' : 'module.disabled', 'module', key);
		return { ok: true };
	}
};
