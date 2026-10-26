<script lang="ts">
	import { ArrowLeft, PackagePlus } from '@lucide/svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { formatQty } from '#lib/core/stock.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const p = $derived(data.purchase);
	const money = (n: number) => formatMoney(n, data.user.currency);
</script>

<svelte:head><title>Delivery</title></svelte:head>

<div class="max-w-4xl space-y-5">
	<a href="/stock/purchases" class="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={16} /> All deliveries</a>

	{#if data.saved}
		<div class="alert-success flex flex-wrap items-center justify-between gap-3">
			<span>Delivery saved. The stock has been added.</span>
			<a href="/stock/purchases/new" class="inline-flex items-center gap-1.5 font-medium hover:underline"><PackagePlus size={16} /> Receive another</a>
		</div>
	{/if}

	<section class="card grid gap-4 p-6 sm:grid-cols-4">
		<div><p class="text-xs text-muted">Supplier</p><p class="font-medium">{p.supplier ?? '—'}</p></div>
		<div><p class="text-xs text-muted">Invoice / waybill no.</p><p class="font-mono text-sm">{p.purchase.reference ?? '—'}</p></div>
		<div>
			<p class="text-xs text-muted">Received</p>
			<p class="font-medium">{new Date(p.purchase.receivedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
		</div>
		<div><p class="text-xs text-muted">Received by</p><p class="font-medium">{p.receivedBy ?? '—'}</p></div>
		{#if p.purchase.note}<div class="sm:col-span-4"><p class="text-xs text-muted">Note</p><p>{p.purchase.note}</p></div>{/if}
	</section>

	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Product</th><th class="text-right">Quantity</th><th class="text-right">Cost each</th><th class="text-right">Line total</th></tr></thead>
			<tbody>
				{#each p.items as item (item.id)}
					<tr>
						<td class="font-medium">{item.name}</td>
						<td class="text-right tabular-nums">{formatQty(item.quantity)} {item.unit ?? ''}</td>
						<td class="text-right tabular-nums">{money(item.unitCost)}</td>
						<td class="text-right tabular-nums">{money(item.lineTotal)}</td>
					</tr>
				{/each}
				<tr>
					<td colspan="3" class="text-right font-semibold">Total</td>
					<td class="text-right font-semibold tabular-nums">{money(p.purchase.total)}</td>
				</tr>
			</tbody>
		</table>
	</div>
</div>
