import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { getOpenShift, shiftSummary } from '#lib/server/services/sales.ts';
import { audit } from '#lib/server/services/audit.ts';
import { field } from '#lib/server/utils/form.ts';
import { toMinor } from '#lib/core/money.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requirePermission(locals, 'shifts.manage');

	// Report for a shift that was just closed
	const closedId = url.searchParams.get('closed');
	if (closedId) {
		const [closed] = await db
			.select()
			.from(schema.shifts)
			.where(and(eq(schema.shifts.id, closedId), eq(schema.shifts.tenantId, auth.tenantId), eq(schema.shifts.userId, auth.userId)));
		if (closed?.closedAt) {
			return { shift: null, closed: { ...closed, summary: await shiftSummary(closed.id, closed.openingCash) } };
		}
	}

	const shift = await getOpenShift(auth);
	return {
		shift: shift ? { ...shift, summary: await shiftSummary(shift.id, shift.openingCash) } : null,
		closed: null
	};
};

export const actions: Actions = {
	open: async ({ request, locals }) => {
		const auth = requirePermission(locals, 'shifts.manage');
		if (await getOpenShift(auth)) redirect(303, '/sell');

		const form = await request.formData();
		const raw = field(form, 'openingCash') || '0';
		const amount = Number(raw);
		if (!Number.isFinite(amount) || amount < 0) return fail(400, { message: 'Enter the cash in the drawer.' });

		const [shift] = await db
			.insert(schema.shifts)
			.values({
				tenantId: auth.tenantId,
				branchId: auth.branchId,
				deviceId: locals.device?.tenantId === auth.tenantId ? locals.device.id : null,
				userId: auth.userId,
				openingCash: toMinor(amount)
			})
			.returning();
		await audit(auth, 'shift.opened', 'shift', shift.id, { openingCash: shift.openingCash });
		redirect(303, '/sell');
	},

	close: async ({ request, locals }) => {
		const auth = requirePermission(locals, 'shifts.manage');
		const shift = await getOpenShift(auth);
		if (!shift) return fail(400, { message: 'You have no open shift.' });

		const form = await request.formData();
		const raw = field(form, 'countedCash');
		const counted = Number(raw);
		if (raw === '' || !Number.isFinite(counted) || counted < 0) return fail(400, { message: 'Count the cash in the drawer and enter the amount.' });

		const summary = await shiftSummary(shift.id, shift.openingCash);
		const countedCash = toMinor(counted);
		await db
			.update(schema.shifts)
			.set({ closedAt: new Date(), countedCash, expectedCash: summary.expectedCash, closingNote: field(form, 'note') || null })
			.where(eq(schema.shifts.id, shift.id));
		await audit(auth, 'shift.closed', 'shift', shift.id, {
			expectedCash: summary.expectedCash,
			countedCash,
			difference: countedCash - summary.expectedCash
		});
		redirect(303, `/shift?closed=${shift.id}`);
	}
};
