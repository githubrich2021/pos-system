<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { History, X } from '@lucide/svelte';
	import MovementTable from '#lib/components/stock/MovementTable.svelte';
	import ProductPicker from '#lib/components/stock/ProductPicker.svelte';
	import { formatQty, STOCK_REASON_LABELS } from '#lib/core/stock.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Builds a link with the current filters, changing only the ones given. Changing a filter goes back to page 1. */
	function link(changes: Record<string, string | null>) {
		const params = new URLSearchParams(page.url.search);
		params.delete('page');
		for (const [k, v] of Object.entries(changes)) {
			if (v) params.set(k, v);
			else params.delete(k);
		}
		const s = params.toString();
		return s ? `?${s}` : '/stock/movements';
	}
</script>

<svelte:head><title>Stock movements</title></svelte:head>

<div class="mb-4 flex flex-wrap items-end gap-3">
	<div class="min-w-64 flex-1 sm:max-w-sm">
		{#if data.product}
			<p class="label">Product</p>
			<div class="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2">
				<div class="min-w-0">
					<p class="truncate text-sm font-medium">{data.product.name}</p>
					<p class="text-xs text-muted">In stock: {formatQty(data.product.stock)} {data.product.unit}</p>
				</div>
				<a href={link({ product: null })} class="text-muted hover:text-ink" aria-label="Show all products"><X size={16} /></a>
			</div>
		{:else}
			<p class="label">Product</p>
			<ProductPicker products={data.products} placeholder="Filter by product" onpick={(p) => goto(link({ product: p.id }))} />
		{/if}
	</div>
	<div>
		<label class="label" for="reason">Reason</label>
		<select id="reason" class="input w-auto" value={data.reason ?? ''} onchange={(e) => goto(link({ reason: e.currentTarget.value || null }))}>
			<option value="">All reasons</option>
			{#each Object.entries(STOCK_REASON_LABELS) as [key, label] (key)}<option value={key}>{label}</option>{/each}
		</select>
	</div>
	{#if data.product}
		<a href="/stock/adjust?product={data.product.id}" class="btn-secondary">Adjust this product</a>
	{/if}
</div>

{#if data.movements.length === 0}
	<div class="card flex flex-col items-center p-12 text-center">
		<History size={32} class="text-muted" />
		<p class="mt-3 font-medium">No stock movements found</p>
	</div>
{:else}
	<div class="card overflow-x-auto">
		<MovementTable movements={data.movements} showProduct={!data.product} />
	</div>
	<div class="mt-4 flex justify-between">
		{#if data.page > 1}
			<a class="btn-secondary" href={link({ page: data.page > 2 ? String(data.page - 1) : null })}>Newer</a>
		{:else}<span></span>{/if}
		{#if data.hasMore}
			<a class="btn-secondary" href={link({ page: String(data.page + 1) })}>Older</a>
		{/if}
	</div>
{/if}
