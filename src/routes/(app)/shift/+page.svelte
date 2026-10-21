<script lang="ts">
	import { enhance } from '$app/forms';
	import { Banknote, Clock, Printer } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { PAYMENT_METHODS } from '#lib/core/pricing.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let counted = $state('');

	const money = (n: number) => formatMoney(n, data.user.currency);
	const time = (d: Date | string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
	const methodName = (m: string) => PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m;
	const difference = $derived(
		data.shift && counted !== '' ? Math.round(Number(counted) * 100) - data.shift.summary.expectedCash : null
	);
</script>

<svelte:head><title>Shift</title></svelte:head>

{#snippet summaryTable(s: NonNullable<typeof data.shift>['summary'], openingCash: number)}
	<dl class="divide-y divide-line text-sm">
		<div class="flex justify-between py-2.5"><dt class="text-muted">Sales</dt><dd>{s.salesCount} · {money(s.salesTotal)}</dd></div>
		{#each s.byMethod as m (m.method)}
			<div class="flex justify-between py-2.5"><dt class="text-muted">{methodName(m.method)}</dt><dd class="tabular-nums">{money(m.amount)}</dd></div>
		{/each}
		{#if s.voidedCount}<div class="flex justify-between py-2.5"><dt class="text-muted">Voided sales</dt><dd>{s.voidedCount}</dd></div>{/if}
		<div class="flex justify-between py-2.5"><dt class="text-muted">Opening cash</dt><dd class="tabular-nums">{money(openingCash)}</dd></div>
		<div class="flex justify-between py-2.5 font-semibold"><dt>Cash expected in drawer</dt><dd class="tabular-nums">{money(s.expectedCash)}</dd></div>
	</dl>
{/snippet}

{#if data.closed}
	{@const c = data.closed}
	{@const diff = (c.countedCash ?? 0) - (c.expectedCash ?? 0)}
	<PageHeader title="Shift closed" subtitle="{time(c.openedAt)} – {time(c.closedAt!)}">
		{#snippet actions()}
			<button class="btn-secondary" onclick={() => print()}><Printer size={16} /> Print</button>
			<a href="/shift" class="btn-primary">Open a new shift</a>
		{/snippet}
	</PageHeader>
	<div class="card max-w-lg p-6">
		{@render summaryTable(c.summary, c.openingCash)}
		<dl class="mt-2 border-t-2 border-line text-sm">
			<div class="flex justify-between py-2.5"><dt class="text-muted">Cash counted</dt><dd class="tabular-nums">{money(c.countedCash ?? 0)}</dd></div>
			<div class="flex justify-between py-2.5 font-semibold">
				<dt>{diff === 0 ? 'Balanced' : diff > 0 ? 'Over' : 'Short'}</dt>
				<dd class="tabular-nums {diff < 0 ? 'text-red-700' : diff > 0 ? 'text-amber-700' : 'text-brand-700'}">{money(diff)}</dd>
			</div>
		</dl>
		{#if c.closingNote}<p class="mt-3 text-sm text-muted">Note: {c.closingNote}</p>{/if}
	</div>
{:else if !data.shift}
	<PageHeader title="Open your shift" subtitle="Count the cash in the drawer before you start selling." />
	<form method="POST" action="?/open" use:enhance class="card max-w-md space-y-4 p-6">
		{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
		<div>
			<label class="label" for="openingCash">Cash in drawer ({data.user.currency})</label>
			<input class="input text-lg" id="openingCash" name="openingCash" type="number" step="0.01" min="0" placeholder="0.00" required />
		</div>
		<button class="btn-primary w-full"><Clock size={16} /> Open shift</button>
	</form>
{:else}
	{@const s = data.shift}
	<PageHeader title="Your shift" subtitle="Open since {time(s.openedAt)}">
		{#snippet actions()}<a href="/sell" class="btn-primary">Back to selling</a>{/snippet}
	</PageHeader>
	<div class="grid gap-6 lg:grid-cols-2">
		<section class="card p-6">
			<h2 class="mb-2 font-semibold">So far</h2>
			{@render summaryTable(s.summary, s.openingCash)}
		</section>
		<form method="POST" action="?/close" use:enhance class="card h-fit space-y-4 p-6">
			<h2 class="flex items-center gap-2 font-semibold"><Banknote size={18} /> Close shift</h2>
			<p class="text-sm text-muted">Count all the cash in the drawer, including the opening float.</p>
			{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
			<div>
				<label class="label" for="countedCash">Cash counted ({data.user.currency})</label>
				<input class="input text-lg" id="countedCash" name="countedCash" type="number" step="0.01" min="0" bind:value={counted} required />
			</div>
			{#if difference !== null}
				<p class="text-sm {difference < 0 ? 'text-red-700' : difference > 0 ? 'text-amber-700' : 'text-brand-700'}">
					{difference === 0 ? 'Drawer balances.' : difference > 0 ? `Over by ${money(difference)}` : `Short by ${money(-difference)}`}
				</p>
			{/if}
			<div>
				<label class="label" for="note">Note <span class="font-normal text-muted">· optional</span></label>
				<input class="input" id="note" name="note" placeholder="e.g. paid GH₵20 for fuel from drawer" />
			</div>
			<button class="btn-danger w-full">Close shift</button>
		</form>
	</div>
{/if}
