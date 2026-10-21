<script lang="ts">
	import { enhance } from '$app/forms';
	import { Printer, Ban, ArrowLeft } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { PAYMENT_METHODS } from '#lib/core/pricing.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let confirming = $state(false);

	const s = $derived(data.sale.sale);
	const money = (n: number) => formatMoney(n, data.user.currency);
	const methodName = (m: string) => PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m;
	const when = (d: Date | string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Sale {s.receiptNo}</title></svelte:head>

<a href="/sales" class="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Sales</a>
<PageHeader title="Receipt {s.receiptNo}" subtitle="{when(s.soldAt)} · {data.sale.cashier} · {data.sale.branch}">
	{#snippet actions()}
		<a href="/receipt/{s.id}?print=1" target="_blank" class="btn-secondary"><Printer size={16} /> Print</a>
		{#if data.canVoid && s.status === 'completed'}
			<button class="btn-danger" onclick={() => (confirming = !confirming)}><Ban size={16} /> Void</button>
		{/if}
	{/snippet}
</PageHeader>

{#if s.status === 'voided'}
	<p class="alert-error mb-4">
		Voided {s.voidedAt ? when(s.voidedAt) : ''} by {data.sale.voidedByName ?? 'unknown'}: “{s.voidReason}”. Stock was returned.
	</p>
{/if}
{#if form?.message}<p class="alert-error mb-4">{form.message}</p>{/if}

{#if confirming && s.status === 'completed'}
	<form method="POST" action="?/void" use:enhance={() => async ({ update }) => { await update(); confirming = false; }} class="card mb-6 max-w-xl space-y-3 border-red-200 p-5">
		<p class="text-sm">Voiding cancels the whole sale and puts the items back in stock. Give the money back to the customer.</p>
		<input class="input" name="reason" placeholder="Reason, e.g. customer changed their mind" required />
		<button class="btn-danger">Void sale of {money(s.total)}</button>
	</form>
{/if}

<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>
			<tbody>
				{#each data.sale.items as item (item.id)}
					<tr>
						<td>{item.name}</td>
						<td class="text-right tabular-nums">{item.quantity}</td>
						<td class="text-right tabular-nums">{money(item.unitPrice)}</td>
						<td class="text-right tabular-nums">{money(item.lineTotal)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="card h-fit p-5">
		<dl class="space-y-1.5 text-sm">
			<div class="flex justify-between"><dt class="text-muted">Subtotal</dt><dd class="tabular-nums">{money(s.subtotal)}</dd></div>
			{#if s.discountTotal}<div class="flex justify-between"><dt class="text-muted">Discount</dt><dd class="tabular-nums">−{money(s.discountTotal)}</dd></div>{/if}
			<div class="flex justify-between"><dt class="text-muted">VAT included</dt><dd class="tabular-nums">{money(s.taxTotal)}</dd></div>
			<div class="flex justify-between border-t border-line pt-2 text-lg font-semibold"><dt>Total</dt><dd class="tabular-nums">{money(s.total)}</dd></div>
		</dl>
		<h3 class="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">Payments</h3>
		<ul class="space-y-1 text-sm">
			{#each data.sale.payments as p (p.id)}
				<li class="flex justify-between">
					<span>{methodName(p.method)}{#if p.reference}<span class="text-xs text-muted"> · {p.reference}</span>{/if}</span>
					<span class="tabular-nums">{money(p.amount)}</span>
				</li>
			{/each}
			{#if s.changeGiven}
				<li class="flex justify-between text-muted"><span>Cash given {money(s.cashTendered)}, change</span><span class="tabular-nums">{money(s.changeGiven)}</span></li>
			{/if}
		</ul>
	</div>
</div>
