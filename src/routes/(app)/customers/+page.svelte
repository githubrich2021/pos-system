<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { HandCoins, Plus, Search, Users } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let adding = $state(false);
	let saving = $state(false);

	$effect.pre(() => {
		if (form?.message) adding = true;
	});

	const money = (n: number) => formatMoney(n, data.user.currency);
	const v = $derived<Record<string, string>>(form?.values ?? {});
	const filterHref = (owing: boolean) => {
		const params = new URLSearchParams();
		if (owing) params.set('show', 'owing');
		if (data.q) params.set('q', data.q);
		const s = params.toString();
		return s ? `?${s}` : '/customers';
	};
</script>

<svelte:head><title>Customers</title></svelte:head>

<PageHeader title="Customers" subtitle="Who your customers are and what they owe.">
	{#snippet actions()}
		<button class="btn-primary" onclick={() => (adding = true)}><Plus size={16} /> Add customer</button>
	{/snippet}
</PageHeader>

<div class="mb-5 grid gap-4 sm:max-w-2xl sm:grid-cols-2">
	<StatCard highlight label="Owed by customers" icon={HandCoins} value={money(data.owed.total)} note="From “Pay later” sales" />
	<StatCard label="Customers who owe" icon={Users} value={data.owed.count} warn={data.owed.count > 0} />
</div>

{#if adding}
	<form
		method="POST"
		action="?/create"
		class="card mb-5 max-w-3xl space-y-4 p-6"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
	>
		<h2 class="font-semibold">New customer</h2>
		{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label class="label" for="name">Name</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input class="input" id="name" name="name" required maxlength="120" value={v.name ?? ''} autofocus />
			</div>
			<div>
				<label class="label" for="phone">Phone</label>
				<input class="input" id="phone" name="phone" type="tel" maxlength="20" value={v.phone ?? ''} />
			</div>
			<div>
				<label class="label" for="email">Email</label>
				<input class="input" id="email" name="email" type="email" maxlength="120" value={v.email ?? ''} />
			</div>
			{#if data.canSetCredit}
				<div>
					<label class="label" for="creditLimit">Credit limit ({data.user.currency})</label>
					<input class="input" id="creditLimit" name="creditLimit" type="number" step="0.01" min="0" placeholder="0 = no credit" value={v.creditLimit ?? ''} />
					<p class="mt-1 text-xs text-muted">The most they can owe at once from “Pay later” sales.</p>
				</div>
			{/if}
			<div class="sm:col-span-2">
				<label class="label" for="notes">Notes</label>
				<input class="input" id="notes" name="notes" maxlength="500" value={v.notes ?? ''} />
			</div>
		</div>
		<div class="flex gap-3">
			<button class="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add customer'}</button>
			<button type="button" class="btn-secondary" onclick={() => (adding = false)}>Cancel</button>
		</div>
	</form>
{/if}

<div class="mb-3 flex flex-wrap items-center gap-3">
	<div class="flex gap-1 rounded-full bg-white p-1">
		<a href={filterHref(false)} class="rounded-full px-3.5 py-1.5 text-sm font-medium {!data.owing ? 'bg-forest text-white' : 'text-muted hover:text-ink'}">All</a>
		<a href={filterHref(true)} class="rounded-full px-3.5 py-1.5 text-sm font-medium {data.owing ? 'bg-forest text-white' : 'text-muted hover:text-ink'}">Owe money</a>
	</div>
	<form class="relative max-w-md min-w-56 flex-1" data-sveltekit-keepfocus>
		{#if data.owing}<input type="hidden" name="show" value="owing" />{/if}
		<Search size={16} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
		<input class="input pl-9" name="q" placeholder="Search name or phone" value={data.q} />
	</form>
</div>

{#if data.customers.length === 0}
	<div class="card flex flex-col items-center p-12 text-center">
		<Users size={32} class="text-muted" />
		<p class="mt-3 font-medium">
			{data.q ? 'No customers match your search' : data.owing ? 'Nobody owes you anything' : 'No customers yet'}
		</p>
		{#if !data.q && !data.owing}
			<p class="mt-1 text-sm text-muted">Add customers here, or from the till while making a sale.</p>
		{/if}
	</div>
{:else}
	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Customer</th><th>Phone</th><th class="text-right">Credit limit</th><th class="text-right">Owes</th></tr></thead>
			<tbody>
				{#each data.customers as c (c.id)}
					<tr class="cursor-pointer hover:bg-canvas" onclick={() => goto(`/customers/${c.id}`)}>
						<td><a href="/customers/{c.id}" class="font-medium hover:underline">{c.name}</a></td>
						<td class="text-muted">{c.phone ?? '—'}</td>
						<td class="text-right text-muted tabular-nums">{c.creditLimit ? money(c.creditLimit) : '—'}</td>
						<td class="text-right font-medium tabular-nums">
							{#if c.balance > 0}
								<span class={c.creditLimit && c.balance >= c.creditLimit ? 'badge bg-red-50 text-red-700' : 'text-amber-700'}>{money(c.balance)}</span>
							{:else if c.balance < 0}
								<span class="text-brand-700">{money(-c.balance)} in credit</span>
							{:else}<span class="text-muted">—</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
