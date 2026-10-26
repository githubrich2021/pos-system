import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '#lib/server/db/index.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { salesReport } from '#lib/server/services/reports.ts';
import type { PageServerLoad } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
	const x = new Date(`${d}T00:00:00Z`);
	x.setUTCDate(x.getUTCDate() + n);
	return iso(x);
};

/** Named ranges, worked out from today's date. Weeks start on Monday. */
function preset(name: string, today: string): { from: string; to: string } | null {
	const t = new Date(`${today}T00:00:00Z`);
	switch (name) {
		case 'today':
			return { from: today, to: today };
		case 'yesterday':
			return { from: addDays(today, -1), to: addDays(today, -1) };
		case 'week':
			return { from: addDays(today, -((t.getUTCDay() + 6) % 7)), to: today };
		case 'last7':
			return { from: addDays(today, -6), to: today };
		case 'month':
			return { from: `${today.slice(0, 7)}-01`, to: today };
		case 'lastmonth': {
			const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
			const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
			return { from: iso(first), to: iso(last) };
		}
		case 'last30':
			return { from: addDays(today, -29), to: today };
		default:
			return null;
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const auth = requirePermission(locals, 'reports.view');

	const [tenant] = await db.select({ tz: schema.tenants.timezone }).from(schema.tenants).where(eq(schema.tenants.id, auth.tenantId));
	const today = new Date().toLocaleDateString('en-CA', { timeZone: tenant?.tz ?? 'Africa/Accra' });

	const p = url.searchParams;
	let range = p.get('range') ?? (p.get('from') ? 'custom' : 'last7');
	let from: string, to: string;
	const named = preset(range, today);
	if (named) ({ from, to } = named);
	else {
		range = 'custom';
		from = DATE.test(p.get('from') ?? '') ? p.get('from')! : addDays(today, -6);
		to = DATE.test(p.get('to') ?? '') ? p.get('to')! : today;
		if (from > to) [from, to] = [to, from];
		// Keep reports to a year at a time
		if (addDays(from, 366) < to) from = addDays(to, -365);
	}

	const branches = await db
		.select({ id: schema.branches.id, name: schema.branches.name })
		.from(schema.branches)
		.where(and(eq(schema.branches.tenantId, auth.tenantId), eq(schema.branches.isActive, true)))
		.orderBy(asc(schema.branches.name));
	const branchId = branches.some((b) => b.id === p.get('branch')) ? p.get('branch') : null;

	return {
		range,
		from,
		to,
		today,
		branchId,
		branches,
		report: await salesReport(auth, { from, to, branchId })
	};
};
