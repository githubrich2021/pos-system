<script lang="ts">
	import { goto } from '$app/navigation';
	import { ReceiptText } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { PAYMENT_METHODS } from '#lib/core/pricing.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const money = (n: number) => formatMoney(n, data.user.currency);
	const methodName = (m: string) => PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m;
</script>

<svelte:head><title>Sales</title></svelte:head>

<PageHeader title="Sales" subtitle={data.seeAll ? 'All sales for the day.' : 'Sales you made.'}>
	{#snippet actions()}
		<input
			class="input w-auto"
			type="date"
			value={data.date}
			aria-label="Day"
			onchange={(e) => goto(`?date=${e.currentTarget.value}`)}
		/>
	{/snippet}
</PageHeader>

<div class="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
	<div class="card p-4">
		<p class="text-sm text-muted">{data.isToday ? 'Today' : data.date}</p>
		<p class="mt-1 text-xl font-semibold tabular-nums">{money(data.summary.total)}</p>
	</div>
	<div class="card p-4">
		<p class="text-sm text-muted">Receipts</p>
		<p class="mt-1 text-xl font-semibold">{data.summary.count}</p>
	</div>
</div>

{#if data.sales.length === 0}
	<div class="card flex flex-col items-center p-12 text-center">
		<ReceiptText size={32} class="text-muted" />
		<p class="mt-3 font-medium">No sales on this day</p>
	</div>
{:else}
	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Time</th><th>Receipt</th>{#if data.seeAll}<th>Cashier</th>{/if}<th>Paid by</th><th class="text-right">Total</th></tr></thead>
			<tbody>
				{#each data.sales as s (s.id)}
					<tr class="cursor-pointer hover:bg-canvas {s.status !== 'completed' ? 'text-muted' : ''}" onclick={() => goto(`/sales/${s.id}`)}>
						<td class="tabular-nums">{new Date(s.soldAt).toLocaleTimeString('en-GB', { timeStyle: 'short' })}</td>
						<td>
							<a href="/sales/{s.id}" class="font-mono text-xs font-medium text-ink hover:underline">{s.receiptNo}</a>
							{#if s.status === 'voided'}<span class="badge ml-1 bg-red-50 text-red-700">Voided</span>{/if}
						</td>
						{#if data.seeAll}<td>{s.cashier}</td>{/if}
						<td class="text-muted">{(s.methods ?? []).map(methodName).join(', ')}</td>
						<td class="text-right font-medium tabular-nums {s.status === 'voided' ? 'line-through' : ''}">{money(s.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
