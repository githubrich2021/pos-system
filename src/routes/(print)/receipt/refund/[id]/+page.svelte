<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { formatMoney } from '#lib/core/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const d = $derived(data.refund);
	const r = $derived(d.refund);
	const t = $derived(d.tenant);
	const money = (n: number) => formatMoney(n, t.currency);
	const METHOD: Record<string, string> = { cash: 'Cash', momo: 'Mobile money', card: 'Card', bank: 'Bank transfer', account: 'Off account balance' };

	onMount(() => {
		if (page.url.searchParams.has('print')) setTimeout(() => print(), 200);
	});
</script>

<svelte:head>
	<title>Refund slip</title>
	<style>
		@page { size: 80mm auto; margin: 4mm; }
	</style>
</svelte:head>

<div class="mx-auto my-6 w-[72mm] bg-white p-4 font-mono text-[11px] leading-snug text-black shadow print:my-0 print:p-0 print:shadow-none">
	<div class="text-center">
		<p class="text-[14px] font-bold">{t.name}</p>
		{#if t.address}<p>{t.address}</p>{/if}
		{#if t.phone}<p>Tel: {t.phone}</p>{/if}
	</div>

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="text-center font-bold">REFUND</p>
	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="flex justify-between"><span>Date</span><span>{new Date(r.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span></p>
	<p class="flex justify-between"><span>Original receipt</span><span>{d.receiptNo}</span></p>
	{#if d.customer}<p class="flex justify-between"><span>Customer</span><span>{d.customer}</span></p>{/if}
	<p class="flex justify-between"><span>Refunded by</span><span>{d.by ?? '—'}</span></p>
	<div class="my-2 border-t border-dashed border-black"></div>

	{#each d.items as item (item.id)}
		<p>{item.name}</p>
		<p class="flex justify-between pl-2"><span>{item.quantity} returned</span><span>{money(item.amount)}</span></p>
	{/each}

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="flex justify-between text-[14px] font-bold"><span>REFUNDED</span><span>{money(r.amount)}</span></p>
	{#if r.tax}<p class="flex justify-between"><span>VAT included</span><span>{money(r.tax)}</span></p>{/if}
	<p class="flex justify-between"><span>{METHOD[r.method] ?? r.method}{r.reference ? ` ${r.reference}` : ''}</span><span>{money(r.amount)}</span></p>
	<p class="mt-1">Reason: {r.reason}</p>

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="text-center">{t.receiptFooter ?? 'Thank you for your business!'}</p>
	<p class="mt-1 text-center text-[9px]">Powered by {PUBLIC_APP_NAME}</p>
</div>

<div class="my-4 text-center print:hidden">
	<button class="btn-primary" onclick={() => print()}>Print</button>
</div>
