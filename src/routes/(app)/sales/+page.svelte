<script lang="ts">
	import { goto } from '$app/navigation';
	import { ReceiptText, Wallet } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
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

<div class="mb-5 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
	<StatCard
		highlight
		label={data.isToday ? 'Total today' : `Total on ${data.date}`}
		icon={Wallet}
		value={money(data.summary.total)}
		note={data.summary.refunded ? `After ${money(data.summary.refunded)} of refunds` : undefined}
	/>
	<StatCard label="Receipts" icon={ReceiptText} value={data.summary.count} />
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
					<tr class="cursor-pointer hover:bg-canvas {s.status === 'voided' || s.status === 'refunded' ? 'text-muted' : ''}" onclick={() => goto(`/sales/${s.id}`)}>
						<td class="tabular-nums">{new Date(s.soldAt).toLocaleTimeString('en-GB', { timeStyle: 'short' })}</td>
						<td>
							<a href="/sales/{s.id}" class="font-mono text-xs font-medium text-ink hover:underline">{s.receiptNo}</a>
							{#if s.status === 'voided'}<span class="badge ml-1 bg-red-50 text-red-700">Voided</span>
							{:else if s.status === 'refunded'}<span class="badge ml-1 bg-amber-100 text-amber-800">Refunded</span>
							{:else if s.status === 'partially_refunded'}<span class="badge ml-1 bg-amber-100 text-amber-800">Part refunded</span>{/if}
						</td>
						{#if data.seeAll}<td>{s.cashier}</td>{/if}
						<td class="text-muted">{(s.methods ?? []).map(methodName).join(', ')}</td>
						<td class="text-right font-medium tabular-nums {s.status === 'voided' ? 'line-through' : ''}">
							{money(s.total)}
							{#if s.refunded}<p class="text-xs font-normal text-red-700">−{money(s.refunded)} refunded</p>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
