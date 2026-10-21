<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { formatMoney } from '#lib/core/money.ts';
	import { PAYMENT_METHODS } from '#lib/core/pricing.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const d = $derived(data.sale);
	const s = $derived(d.sale);
	const t = $derived(d.tenant);
	const money = (n: number) => formatMoney(n, t.currency);
	const methodName = (m: string) => PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m;

	onMount(() => {
		if (page.url.searchParams.has('print')) setTimeout(() => print(), 200);
	});
</script>

<svelte:head>
	<title>Receipt {s.receiptNo}</title>
	<style>
		@page { size: 80mm auto; margin: 4mm; }
	</style>
</svelte:head>

<!-- Sized for 80mm thermal printers; also prints fine on A4. -->
<div class="mx-auto my-6 w-[72mm] bg-white p-4 font-mono text-[11px] leading-snug text-black shadow print:my-0 print:p-0 print:shadow-none">
	<div class="text-center">
		<p class="text-[14px] font-bold">{t.name}</p>
		{#if t.address}<p>{t.address}</p>{/if}
		{#if t.phone}<p>Tel: {t.phone}</p>{/if}
		{#if t.taxId}<p>TIN: {t.taxId}</p>{/if}
	</div>

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="flex justify-between"><span>Receipt</span><span>{s.receiptNo}</span></p>
	<p class="flex justify-between"><span>Date</span><span>{new Date(s.soldAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span></p>
	<p class="flex justify-between"><span>Served by</span><span>{d.cashier}</span></p>
	{#if s.status === 'voided'}<p class="mt-1 text-center font-bold">*** VOIDED ***</p>{/if}
	<div class="my-2 border-t border-dashed border-black"></div>

	{#each d.items as item (item.id)}
		<p>{item.name}</p>
		<p class="flex justify-between pl-2">
			<span>{item.quantity} x {money(item.unitPrice)}</span>
			<span>{money(Math.round(item.unitPrice * item.quantity))}</span>
		</p>
	{/each}

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="flex justify-between"><span>Subtotal</span><span>{money(s.subtotal)}</span></p>
	{#if s.discountTotal}<p class="flex justify-between"><span>Discount</span><span>-{money(s.discountTotal)}</span></p>{/if}
	<p class="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{money(s.total)}</span></p>
	{#if s.taxTotal}<p class="flex justify-between"><span>VAT included</span><span>{money(s.taxTotal)}</span></p>{/if}

	<div class="my-2 border-t border-dashed border-black"></div>
	{#each d.payments as p (p.id)}
		{#if p.method === 'cash' && s.changeGiven}
			<p class="flex justify-between"><span>Cash</span><span>{money(s.cashTendered)}</span></p>
		{:else}
			<p class="flex justify-between"><span>{methodName(p.method)}{p.reference ? ` ${p.reference}` : ''}</span><span>{money(p.amount)}</span></p>
		{/if}
	{/each}
	{#if s.changeGiven}<p class="flex justify-between font-bold"><span>Change</span><span>{money(s.changeGiven)}</span></p>{/if}

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="text-center">{t.receiptFooter ?? 'Thank you for your business!'}</p>
	<p class="mt-1 text-center text-[9px]">Powered by {PUBLIC_APP_NAME}</p>
</div>

<div class="my-4 text-center print:hidden">
	<button class="btn-primary" onclick={() => print()}>Print</button>
</div>
