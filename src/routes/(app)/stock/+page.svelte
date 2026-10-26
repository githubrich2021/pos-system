<script lang="ts">
	import { AlertTriangle, Boxes, PackageX, Search, Wallet } from '@lucide/svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import MovementTable from '#lib/components/stock/MovementTable.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { formatQty } from '#lib/core/stock.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const money = (n: number) => formatMoney(n, data.user.currency);

	const filters = $derived([
		{ key: 'all', label: `All (${data.summary.products})` },
		{ key: 'low', label: `Running low (${data.summary.low})` },
		{ key: 'out', label: `Out of stock (${data.summary.out})` }
	]);
	const filterHref = (key: string) => {
		const params = new URLSearchParams();
		if (key !== 'all') params.set('show', key);
		if (data.q) params.set('q', data.q);
		const s = params.toString();
		return s ? `?${s}` : '/stock';
	};
</script>

<svelte:head><title>Stock</title></svelte:head>

<div class="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard highlight label="Stock value (cost)" icon={Wallet} value={money(data.summary.costValue)} note="What you paid for what's on the shelf" />
	<StatCard label="Stock value (selling price)" icon={Boxes} value={money(data.summary.retailValue)} />
	<StatCard label="Running low" icon={AlertTriangle} value={data.summary.low} warn={data.summary.low > 0} />
	<StatCard label="Out of stock" icon={PackageX} value={data.summary.out} warn={data.summary.out > 0} />
</div>

<div class="grid gap-5 xl:grid-cols-[1fr_24rem]">
	<section class="min-w-0">
		<div class="mb-3 flex flex-wrap items-center gap-3">
			<div class="flex gap-1 rounded-full bg-white p-1">
				{#each filters as f (f.key)}
					<a
						href={filterHref(f.key)}
						class="rounded-full px-3.5 py-1.5 text-sm font-medium {data.show === f.key ? 'bg-forest text-white' : 'text-muted hover:text-ink'}"
						>{f.label}</a
					>
				{/each}
			</div>
			<form class="relative min-w-56 flex-1" data-sveltekit-keepfocus>
				{#if data.show !== 'all'}<input type="hidden" name="show" value={data.show} />{/if}
				<Search size={16} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
				<input class="input pl-9" name="q" placeholder="Search name, SKU or scan barcode" value={data.q} />
			</form>
		</div>

		{#if data.products.length === 0}
			<div class="card flex flex-col items-center p-12 text-center">
				<Boxes size={32} class="text-muted" />
				<p class="mt-3 font-medium">
					{data.q ? 'No products match your search' : data.show === 'all' ? 'No stock-tracked products yet' : 'Nothing here — stock looks good'}
				</p>
			</div>
		{:else}
			<div class="card overflow-x-auto">
				<table class="table-base">
					<thead>
						<tr><th>Product</th><th>Category</th><th class="text-right">In stock</th><th class="text-right">Alert at</th><th class="text-right">Value (cost)</th></tr>
					</thead>
					<tbody>
						{#each data.products as p (p.id)}
							<tr>
								<td>
									<a href="/stock/movements?product={p.id}" class="font-medium hover:underline">{p.name}</a>
									{#if p.sku}<p class="font-mono text-xs text-muted">{p.sku}</p>{/if}
								</td>
								<td class="text-muted">{p.category ?? '—'}</td>
								<td class="text-right whitespace-nowrap tabular-nums">
									{#if p.status === 'out'}<span class="badge bg-red-50 text-red-700">{formatQty(p.stock)} {p.unit}</span>
									{:else if p.status === 'low'}<span class="badge bg-amber-100 text-amber-800">{formatQty(p.stock)} {p.unit}</span>
									{:else}{formatQty(p.stock)} {p.unit}{/if}
								</td>
								<td class="text-right text-muted tabular-nums">{p.lowStockLevel !== null ? formatQty(p.lowStockLevel) : '—'}</td>
								<td class="text-right tabular-nums">{money(Math.round(Math.max(p.stock, 0) * p.costPrice))}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<aside class="min-w-0">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="font-semibold">Recent movements</h2>
			<a href="/stock/movements" class="text-sm font-medium text-brand-600 hover:underline">See all</a>
		</div>
		<div class="card overflow-x-auto">
			{#if data.recent.length}
				<MovementTable movements={data.recent} />
			{:else}
				<p class="p-6 text-center text-sm text-muted">No stock movements yet.</p>
			{/if}
		</div>
	</aside>
</div>
