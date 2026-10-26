<script lang="ts">
	import { goto } from '$app/navigation';
	import { PackagePlus, Truck } from '@lucide/svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const money = (n: number) => formatMoney(n, data.user.currency);
	const when = (d: Date | string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>Deliveries</title></svelte:head>

{#if data.purchases.length === 0}
	<div class="card flex flex-col items-center p-12 text-center">
		<Truck size={32} class="text-muted" />
		<p class="mt-3 font-medium">No deliveries recorded yet</p>
		<p class="mt-1 text-sm text-muted">When stock arrives from a supplier, record it here so your stock levels and costs stay right.</p>
		<a href="/stock/purchases/new" class="btn-primary mt-5"><PackagePlus size={16} /> Receive stock</a>
	</div>
{:else}
	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Received</th><th>Supplier</th><th>Invoice no.</th><th>Received by</th><th class="text-right">Products</th><th class="text-right">Total cost</th></tr></thead>
			<tbody>
				{#each data.purchases as p (p.id)}
					<tr class="cursor-pointer hover:bg-canvas" onclick={() => goto(`/stock/purchases/${p.id}`)}>
						<td class="whitespace-nowrap tabular-nums"><a href="/stock/purchases/{p.id}" class="hover:underline">{when(p.receivedAt)}</a></td>
						<td class="font-medium">{p.supplier ?? '—'}</td>
						<td class="font-mono text-xs text-muted">{p.reference ?? '—'}</td>
						<td class="text-muted">{p.receivedBy ?? '—'}</td>
						<td class="text-right tabular-nums">{p.lines}</td>
						<td class="text-right font-medium tabular-nums">{money(p.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
