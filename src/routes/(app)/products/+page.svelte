<script lang="ts">
	import { Plus, Search, Package } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { can } from '#lib/core/permissions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const canManage = $derived(can(data.user.permissions, 'products.manage'));
</script>

<svelte:head><title>Products</title></svelte:head>

<PageHeader title="Products" subtitle="Everything you sell, with live stock for this branch.">
	{#snippet actions()}
		{#if canManage}<a href="/products/new" class="btn-primary"><Plus size={16} /> Add product</a>{/if}
	{/snippet}
</PageHeader>

<form class="relative mb-4 max-w-md" data-sveltekit-keepfocus>
	<Search size={16} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
	<input class="input pl-9" name="q" placeholder="Search name, SKU or scan barcode" value={data.q} />
</form>

{#if data.products.length === 0}
	<div class="card flex flex-col items-center p-12 text-center">
		<Package size={32} class="text-muted" />
		<p class="mt-3 font-medium">{data.q ? 'No products match your search' : 'No products yet'}</p>
		{#if !data.q && canManage}
			<a href="/products/new" class="btn-primary mt-5"><Plus size={16} /> Add your first product</a>
		{/if}
	</div>
{:else}
	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead>
				<tr><th>Product</th><th>Category</th><th>SKU / barcode</th><th class="text-right">Price</th><th class="text-right">In stock</th></tr>
			</thead>
			<tbody>
				{#each data.products as p (p.id)}
					{@const low = p.trackStock && p.lowStockLevel !== null && p.stock <= p.lowStockLevel}
					<tr>
						<td class="font-medium">{p.name}</td>
						<td class="text-muted">{p.category ?? '—'}</td>
						<td class="font-mono text-xs text-muted">{p.sku ?? ''}{p.sku && p.barcode ? ' · ' : ''}{p.barcode ?? ''}</td>
						<td class="text-right tabular-nums">{formatMoney(p.sellPrice, data.user.currency)}</td>
						<td class="text-right tabular-nums">
							{#if !p.trackStock}<span class="text-muted">—</span>
							{:else}
								<span class={low ? 'badge bg-amber-100 text-amber-800' : ''}>{p.stock} {p.unit}</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
