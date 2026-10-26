<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { BarChart3, Download, HandCoins, Percent, Printer, Undo2, Wallet } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import DailyChart from '#lib/components/reports/DailyChart.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const r = $derived(data.report);
	const s = $derived(r.summary);
	const money = (n: number) => formatMoney(n, data.user.currency);
	const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
	const qty = (q: number) => Number(q.toFixed(3)).toString();
	const dayName = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

	const PRESETS = [
		{ key: 'today', label: 'Today' },
		{ key: 'yesterday', label: 'Yesterday' },
		{ key: 'week', label: 'This week' },
		{ key: 'last7', label: 'Last 7 days' },
		{ key: 'month', label: 'This month' },
		{ key: 'lastmonth', label: 'Last month' },
		{ key: 'last30', label: 'Last 30 days' }
	];
	const METHOD: Record<string, string> = {
		cash: 'Cash',
		momo: 'Mobile money',
		card: 'Card',
		bank: 'Bank transfer',
		credit: 'Pay later (credit given)',
		account: 'Refunds taken off customer accounts'
	};

	const TABS = [
		{ key: 'products', label: 'Products' },
		{ key: 'categories', label: 'Categories' },
		{ key: 'staff', label: 'Staff' },
		{ key: 'payments', label: 'Payments' },
		{ key: 'days', label: 'By day' }
	] as const;
	type Tab = (typeof TABS)[number]['key'];
	let tab = $state<Tab>('products');
	$effect.pre(() => {
		const t = page.url.searchParams.get('tab');
		if (TABS.some((x) => x.key === t)) tab = t as Tab;
	});

	let customFrom = $state('');
	let customTo = $state('');
	$effect.pre(() => {
		customFrom = data.from;
		customTo = data.to;
	});

	function link(changes: Record<string, string | null>) {
		const params = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(changes)) {
			if (v) params.set(k, v);
			else params.delete(k);
		}
		return `?${params}`;
	}
	const rangeLabel = $derived(data.from === data.to ? dayName(data.from) : `${dayName(data.from)} – ${dayName(data.to)}`);

	/** Builds a CSV in the browser and downloads it. Money is in cedis, not pesewas. */
	function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
		const cell = (v: string | number) => {
			const t = String(v);
			return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
		};
		const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
		const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
		const a = Object.assign(document.createElement('a'), { href: url, download: `${name}_${data.from}_to_${data.to}.csv` });
		a.click();
		URL.revokeObjectURL(url);
	}
	const cedis = (minor: number) => (minor / 100).toFixed(2);

	function exportTab() {
		if (tab === 'products')
			downloadCsv('products', ['Product', 'Category', 'Sold', 'Unit', 'Returned', 'Net sales', 'Cost', 'Profit'], r.byProduct.map((p) => [p.name, p.category, qty(p.sold), p.unit, qty(p.returned), cedis(p.net), cedis(p.cost), cedis(p.profit)]));
		else if (tab === 'categories')
			downloadCsv('categories', ['Category', 'Products', 'Net sales', 'Cost', 'Profit'], r.byCategory.map((c) => [c.category, c.products, cedis(c.net), cedis(c.cost), cedis(c.profit)]));
		else if (tab === 'staff')
			downloadCsv('staff', ['Staff', 'Sales', 'Total', 'Average sale', 'Discounts given'], r.byCashier.map((c) => [c.name, c.count, cedis(c.total), cedis(c.count ? Math.round(c.total / c.count) : 0), cedis(c.discount)]));
		else if (tab === 'payments')
			downloadCsv('payments', ['Method', 'From sales', 'Refunded', 'Customer payments', 'Net'], r.byMethod.map((m) => [METHOD[m.method] ?? m.method, cedis(m.taken), cedis(m.refunded), cedis(m.repaid), cedis(m.net)]));
		else downloadCsv('daily', ['Date', 'Sales', 'Sales total', 'Refunds', 'Net sales'], r.days.map((d) => [d.day, d.count, cedis(d.sales), cedis(d.refunds), cedis(d.net)]));
	}

	const tabEmpty = $derived(
		tab === 'products' ? !r.byProduct.length : tab === 'categories' ? !r.byCategory.length : tab === 'staff' ? !r.byCashier.length : tab === 'payments' ? !r.byMethod.length : false
	);
</script>

<svelte:head><title>Reports</title></svelte:head>

	{#snippet row(label: string, value: string, opts: { strong?: boolean; sub?: boolean; line?: boolean } = {})}
		<div class="flex justify-between py-1.5 {opts.line ? 'border-t border-line' : ''} {opts.strong ? 'font-semibold' : ''}">
			<dt class={opts.sub ? 'pl-3 text-muted' : opts.strong ? '' : 'text-muted'}>{label}</dt>
			<dd class="tabular-nums">{value}</dd>
		</div>
	{/snippet}

<PageHeader title="Reports" subtitle={rangeLabel}>
	{#snippet actions()}
		<button class="btn-secondary" onclick={() => print()}><Printer size={16} /> Print</button>
	{/snippet}
</PageHeader>

<!-- Filters: one row above everything they control -->
<div class="mb-5 flex flex-wrap items-center gap-3 print:hidden">
	<div class="flex flex-wrap gap-1 rounded-full bg-white p-1">
		{#each PRESETS as p (p.key)}
			<a
				href={link({ range: p.key, from: null, to: null })}
				class="rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap {data.range === p.key ? 'bg-forest text-white' : 'text-muted hover:text-ink'}"
				>{p.label}</a
			>
		{/each}
	</div>
	<form
		class="flex flex-wrap items-center gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			goto(link({ range: null, from: customFrom, to: customTo }));
		}}
	>
		<input class="input w-auto py-2" type="date" bind:value={customFrom} max={data.today} aria-label="From" />
		<span class="text-sm text-muted">to</span>
		<input class="input w-auto py-2" type="date" bind:value={customTo} max={data.today} aria-label="To" />
		<button class="btn-secondary py-2 {data.range === 'custom' ? 'border-brand-500' : ''}">Show</button>
	</form>
	{#if data.branches.length > 1}
		<select class="input w-auto py-2" value={data.branchId ?? ''} onchange={(e) => goto(link({ branch: e.currentTarget.value || null }))} aria-label="Branch">
			<option value="">All branches</option>
			{#each data.branches as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
		</select>
	{/if}
</div>

<div class="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard highlight label="Net sales" icon={Wallet} value={money(s.netSales)} note="{s.salesCount} sale{s.salesCount === 1 ? '' : 's'} · after refunds" />
	<StatCard label="Gross profit" icon={BarChart3} value={money(s.profit)} note="Margin {pct(s.margin)} (before VAT)" warn={s.profit < 0} />
	<StatCard label="VAT collected" icon={Percent} value={money(s.vat)} note="Included in net sales" />
	<StatCard label="Refunds" icon={Undo2} value={money(s.refunds)} note="{s.refundCount} refund{s.refundCount === 1 ? '' : 's'}" />
</div>

<div class="mb-5 grid gap-5 xl:grid-cols-[1fr_22rem]">
	<section class="card min-w-0 p-5">
		<h2 class="font-semibold">Net sales per day</h2>
		<p class="mb-3 text-xs text-muted">Sales minus refunds, in {data.user.currency}. Hover a day for details.</p>
		{#if s.salesCount || s.refunds}
			<DailyChart days={r.days} format={money} />
		{:else}
			<p class="py-16 text-center text-sm text-muted">No sales in this period.</p>
		{/if}
	</section>

	<section class="card p-5">
		<h2 class="mb-2 font-semibold">Summary</h2>
		<dl class="text-sm">
			{@render row('Gross sales', money(s.grossSales))}
			{@render row('Discounts', `−${money(s.discounts)}`, { sub: true })}
			{@render row('Sales', money(s.salesTotal), { line: true })}
			{@render row('Refunds', `−${money(s.refunds)}`, { sub: true })}
			{@render row('Net sales', money(s.netSales), { strong: true, line: true })}
			{@render row('VAT', `−${money(s.vat)}`, { sub: true })}
			{@render row('Net sales before VAT', money(s.netExVat), { line: true })}
			{@render row('Cost of goods sold', `−${money(s.costOfSales)}`, { sub: true })}
			{@render row('Gross profit', money(s.profit), { strong: true, line: true })}
		</dl>
		<dl class="mt-4 border-t-2 border-line pt-2 text-sm">
			{@render row('Average sale', money(s.averageSale))}
			{@render row('Sold on credit (pay later)', money(s.creditGiven))}
			{@render row('Customer payments received', money(s.repaid))}
			{@render row('Voided sales', `${s.voidedCount} · ${money(s.voidedTotal)}`)}
			{@render row('Stock damaged, expired or lost', money(s.stockLosses))}
		</dl>
		<p class="mt-3 text-xs text-muted">Cost uses the cost price at the time of each sale. Stock losses are at today's cost price.</p>
	</section>
</div>

<section class="card p-5">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
		<nav class="flex gap-1 overflow-x-auto print:hidden" aria-label="Report breakdown">
			{#each TABS as t (t.key)}
				<a
					href={link({ tab: t.key === 'products' ? null : t.key })}
					onclick={(e) => {
						e.preventDefault();
						tab = t.key;
						history.replaceState(history.state, '', link({ tab: t.key === 'products' ? null : t.key }));
					}}
					class="rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap {tab === t.key ? 'bg-brand-50 text-brand-700' : 'text-muted hover:text-ink'}"
					aria-current={tab === t.key ? 'page' : undefined}>{t.label}</a
				>
			{/each}
		</nav>
		{#if !tabEmpty}
			<button class="btn-secondary py-1.5 text-sm print:hidden" onclick={exportTab}><Download size={14} /> Download CSV</button>
		{/if}
	</div>

	{#if tabEmpty}
		<p class="py-10 text-center text-sm text-muted">Nothing to show for this period.</p>
	{:else}
		<div class="overflow-x-auto">
			{#if tab === 'products'}
				<table class="table-base">
					<thead><tr><th>Product</th><th>Category</th><th class="text-right">Sold</th><th class="text-right">Returned</th><th class="text-right">Net sales</th><th class="text-right">Cost</th><th class="text-right">Profit</th><th class="text-right">Margin</th></tr></thead>
					<tbody>
						{#each r.byProduct as p (p.name + p.category)}
							{@const exVat = p.profit + p.cost}
							<tr>
								<td class="font-medium">{p.name}</td>
								<td class="text-muted">{p.category}</td>
								<td class="text-right tabular-nums">{qty(p.sold)} {p.unit}</td>
								<td class="text-right text-muted tabular-nums">{p.returned ? qty(p.returned) : '—'}</td>
								<td class="text-right tabular-nums">{money(p.net)}</td>
								<td class="text-right text-muted tabular-nums">{money(p.cost)}</td>
								<td class="text-right font-medium tabular-nums {p.profit < 0 ? 'text-red-700' : ''}">{money(p.profit)}</td>
								<td class="text-right text-muted tabular-nums">{pct(exVat > 0 ? p.profit / exVat : null)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if r.byProduct.some((p) => p.cost === 0 && p.net > 0)}
					<p class="mt-3 text-xs text-muted">Products with no cost price show 100% profit. Add cost prices on the product or when receiving stock.</p>
				{/if}
			{:else if tab === 'categories'}
				<table class="table-base">
					<thead><tr><th>Category</th><th class="text-right">Products sold</th><th class="text-right">Net sales</th><th class="text-right">Share</th><th class="text-right">Profit</th></tr></thead>
					<tbody>
						{#each r.byCategory as c (c.category)}
							<tr>
								<td class="font-medium">{c.category}</td>
								<td class="text-right tabular-nums">{c.products}</td>
								<td class="text-right tabular-nums">{money(c.net)}</td>
								<td class="text-right text-muted tabular-nums">{pct(s.netSales > 0 ? c.net / s.netSales : null)}</td>
								<td class="text-right font-medium tabular-nums {c.profit < 0 ? 'text-red-700' : ''}">{money(c.profit)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else if tab === 'staff'}
				<table class="table-base">
					<thead><tr><th>Staff</th><th class="text-right">Sales</th><th class="text-right">Total</th><th class="text-right">Average sale</th><th class="text-right">Discounts given</th></tr></thead>
					<tbody>
						{#each r.byCashier as c (c.userId)}
							<tr>
								<td class="font-medium">{c.name}</td>
								<td class="text-right tabular-nums">{c.count}</td>
								<td class="text-right tabular-nums">{money(c.total)}</td>
								<td class="text-right tabular-nums">{money(c.count ? Math.round(c.total / c.count) : 0)}</td>
								<td class="text-right text-muted tabular-nums">{money(c.discount)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="mt-3 text-xs text-muted">Totals are before refunds.</p>
			{:else if tab === 'payments'}
				<table class="table-base">
					<thead><tr><th>Method</th><th class="text-right">From sales</th><th class="text-right">Refunded</th><th class="text-right">Customer payments</th><th class="text-right">Net</th></tr></thead>
					<tbody>
						{#each r.byMethod as m (m.method)}
							<tr>
								<td class="font-medium">{METHOD[m.method] ?? m.method}</td>
								<td class="text-right tabular-nums">{m.taken ? money(m.taken) : '—'}</td>
								<td class="text-right tabular-nums">{m.refunded ? `−${money(m.refunded)}` : '—'}</td>
								<td class="text-right tabular-nums">{m.repaid ? money(m.repaid) : '—'}</td>
								<td class="text-right font-medium tabular-nums">{money(m.net)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="mt-3 flex items-start gap-1.5 text-xs text-muted">
					<HandCoins size={14} class="mt-px shrink-0" /> "Pay later" is money still owed, not money received. Customer payments are money received for earlier credit sales.
				</p>
			{:else}
				<table class="table-base">
					<thead><tr><th>Date</th><th class="text-right">Sales</th><th class="text-right">Sales total</th><th class="text-right">Refunds</th><th class="text-right">Net sales</th></tr></thead>
					<tbody>
						{#each [...r.days].reverse() as d (d.day)}
							<tr class={d.count || d.refunds ? '' : 'text-muted'}>
								<td>{dayName(d.day)}</td>
								<td class="text-right tabular-nums">{d.count}</td>
								<td class="text-right tabular-nums">{money(d.sales)}</td>
								<td class="text-right tabular-nums">{d.refunds ? `−${money(d.refunds)}` : '—'}</td>
								<td class="text-right font-medium tabular-nums">{money(d.net)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</section>
