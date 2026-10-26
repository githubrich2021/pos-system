<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { formatMoney } from '#lib/core/money.ts';
	import { PAYMENT_METHODS } from '#lib/core/pricing.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const d = $derived(data.payment);
	const p = $derived(d.payment);
	const t = $derived(d.tenant);
	const money = (n: number) => formatMoney(n, t.currency);

	onMount(() => {
		if (page.url.searchParams.has('print')) setTimeout(() => print(), 200);
	});
</script>

<svelte:head>
	<title>Payment receipt</title>
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
	<p class="text-center font-bold">PAYMENT RECEIVED</p>
	{#if p.voidedAt}<p class="mt-1 text-center font-bold">*** CANCELLED ***</p>{/if}
	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="flex justify-between"><span>Date</span><span>{new Date(p.paidAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span></p>
	<p class="flex justify-between"><span>Customer</span><span>{d.customer}</span></p>
	{#if d.customerPhone}<p class="flex justify-between"><span>Phone</span><span>{d.customerPhone}</span></p>{/if}
	<p class="flex justify-between"><span>Received by</span><span>{d.takenBy ?? '—'}</span></p>
	<p class="flex justify-between"><span>Ref</span><span>{p.id.slice(0, 8).toUpperCase()}</span></p>

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="flex justify-between text-[14px] font-bold"><span>PAID</span><span>{money(p.amount)}</span></p>
	<p class="flex justify-between">
		<span>{PAYMENT_METHODS[p.method]}{p.reference ? ` ${p.reference}` : ''}</span><span>{money(p.amount)}</span>
	</p>
	<p class="mt-1 flex justify-between font-bold"><span>Balance owed now</span><span>{money(Math.max(d.balanceNow, 0))}</span></p>

	<div class="my-2 border-t border-dashed border-black"></div>
	<p class="text-center">{t.receiptFooter ?? 'Thank you for your business!'}</p>
	<p class="mt-1 text-center text-[9px]">Powered by {PUBLIC_APP_NAME}</p>
</div>

<div class="my-4 text-center print:hidden">
	<button class="btn-primary" onclick={() => print()}>Print</button>
</div>
