import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { cancelStockTake, completeStockTake, getStockTake, saveCounts, StockError } from '#lib/server/services/stock.ts';
import { field } from '#lib/server/utils/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const auth = requirePermission(locals, 'stock.adjust');
	const take = await getStockTake(auth, params.id);
	if (!take) error(404, 'Stock take not found.');
	return { take };
};

/** Counts arrive as JSON: { productId: number | null }. */
function readCounts(form: FormData): Record<string, number | null> | null {
	try {
		const parsed = JSON.parse(field(form, 'counts') || '{}');
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
		const counts: Record<string, number | null> = {};
		for (const [k, v] of Object.entries(parsed)) counts[k] = v === null || v === '' ? null : Number(v);
		return counts;
	} catch {
		return null;
	}
}

async function run<T>(fn: () => Promise<T>) {
	try {
		return { ok: true as const, value: await fn() };
	} catch (e) {
		if (e instanceof StockError) return { ok: false as const, fail: fail(e.status, { message: e.message }) };
		throw e;
	}
}

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const counts = readCounts(await request.formData());
		if (!counts) return fail(400, { message: 'Something went wrong reading the counts. Please try again.' });
		const r = await run(() => saveCounts(auth, params.id, counts));
		if (!r.ok) return r.fail;
		return { saved: true };
	},
	complete: async ({ locals, params, request }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const counts = readCounts(await request.formData());
		if (!counts) return fail(400, { message: 'Something went wrong reading the counts. Please try again.' });
		const saved = await run(() => saveCounts(auth, params.id, counts));
		if (!saved.ok) return saved.fail;
		const r = await run(() => completeStockTake(auth, params.id));
		if (!r.ok) return r.fail;
		return { completed: r.value };
	},
	cancel: async ({ locals, params }) => {
		const auth = requirePermission(locals, 'stock.adjust');
		const r = await run(() => cancelStockTake(auth, params.id));
		if (!r.ok) return r.fail;
		return { cancelled: true };
	}
};
