<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { ArrowLeft, HandCoins, Pencil, Printer } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { PAYMENT_METHODS } from '#lib/core/pricing.ts';
	import { uuid } from '#lib/uuid.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const c = $derived(data.customer);
	const money = (n: number) => formatMoney(n, data.user.currency);
	const when = (d: Date | string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
	const methodName = (m: string) => PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m;
	const REPAY = ['cash', 'momo', 'card', 'bank'] as const;

	let editing = $state(false);
	let paying = $state(false);
	let busy = $state(false);
	let voiding = $state<string | null>(null);
	// New ID per payment, so a double click records it once
	let paymentId = $state(uuid());
	let method = $state<(typeof REPAY)[number]>('cash');
	let amount = $state('');

	const done: SubmitFunction = ({ action }) => {
		busy = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			busy = false;
			if (result.type === 'success') {
				editing = false;
				voiding = null;
				if (action.search === '?/pay') {
					paying = false;
					amount = '';
					paymentId = uuid();
				}
			}
		};
	};

	function startPaying() {
		paying = true;
		amount = (Math.max(c.balance, 0) / 100).toFixed(2);
	}
</script>

<svelte:head><title>{c.name}</title></svelte:head>

<a href="/customers" class="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Customers</a>
<PageHeader title={c.name} subtitle={[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'}>
	{#snippet actions()}
		<button class="btn-secondary" onclick={() => (editing = !editing)}><Pencil size={16} /> Edit</button>
		{#if c.balance > 0}<button class="btn-primary" onclick={startPaying}><HandCoins size={16} /> Record payment</button>{/if}
	{/snippet}
</PageHeader>

{#if form?.message}<p class="alert-error mb-4">{form.message}</p>{/if}
{#if form?.updated}<p class="alert-success mb-4">Customer saved.</p>{/if}
{#if form?.voided}<p class="alert-success mb-4">Payment cancelled. It no longer counts towards the balance.</p>{/if}
{#if form?.paid}
	<p class="alert-success mb-4 flex flex-wrap items-center justify-between gap-2">
		<span>Payment recorded. {c.balance > 0 ? `${c.name} now owes ${money(c.balance)}.` : `${c.name} has paid everything they owed.`}</span>
		<a href="/receipt/payment/{form.paid.id}?print=1" target="_blank" class="inline-flex items-center gap-1.5 font-medium hover:underline"><Printer size={14} /> Print receipt</a>
	</p>
{/if}

<div class="mb-5 grid gap-4 sm:grid-cols-3">
	<div class="rounded-2xl p-5 {c.balance > 0 ? 'bg-forest text-white' : 'bg-white'}">
		<p class="text-sm {c.balance > 0 ? 'text-white/75' : 'text-muted'}">{c.balance < 0 ? 'In credit' : 'Owes'}</p>
		<p class="mt-1 text-2xl font-semibold tabular-nums">{money(Math.abs(c.balance))}</p>
	</div>
	<div class="card p-5">
		<p class="text-sm text-muted">Credit limit</p>
		<p class="mt-1 text-2xl font-semibold tabular-nums">{c.creditLimit ? money(c.creditLimit) : 'No credit'}</p>
	</div>
	<div class="card p-5">
		<p class="text-sm text-muted">Can still buy on credit</p>
		<p class="mt-1 text-2xl font-semibold tabular-nums">{money(c.available)}</p>
	</div>
</div>

{#if paying}
	<form method="POST" action="?/pay" use:enhance={done} class="card mb-5 max-w-2xl space-y-4 p-6">
		<input type="hidden" name="id" value={paymentId} />
		<input type="hidden" name="method" value={method} />
		<h2 class="font-semibold">Record a payment from {c.name}</h2>
		<div class="grid grid-cols-4 gap-2">
			{#each REPAY as m (m)}
				<button
					type="button"
					class="rounded-lg border px-2 py-2.5 text-sm font-medium {method === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line hover:bg-canvas'}"
					onclick={() => (method = m)}>{methodName(m)}</button
				>
			{/each}
		</div>
		{#if method === 'cash' && !data.hasShift}
			<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
				Cash must go in a drawer. <a href="/shift" class="font-medium underline">Open your shift</a> first, or choose another method.
			</p>
		{/if}
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label class="label" for="amount">Amount ({data.user.currency})</label>
				<input class="input text-lg tabular-nums" id="amount" name="amount" type="number" step="0.01" min="0.01" max={c.balance / 100} bind:value={amount} required />
				<p class="mt-1 text-xs text-muted">They owe {money(c.balance)}.</p>
			</div>
			<div>
				<label class="label" for="reference">{method === 'momo' ? 'MoMo transaction ID' : 'Reference'} (optional)</label>
				<input class="input" id="reference" name="reference" maxlength="100" />
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="pay-note">Note (optional)</label>
				<input class="input" id="pay-note" name="note" maxlength="300" />
			</div>
		</div>
		<div class="flex gap-3">
			<button class="btn-primary" disabled={busy || (method === 'cash' && !data.hasShift)}>{busy ? 'Saving…' : 'Save payment'}</button>
			<button type="button" class="btn-secondary" onclick={() => (paying = false)}>Cancel</button>
		</div>
	</form>
{/if}

{#if editing}
	<form method="POST" action="?/update" use:enhance={done} class="card mb-5 max-w-3xl space-y-4 p-6">
		<h2 class="font-semibold">Edit customer</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div><label class="label" for="name">Name</label><input class="input" id="name" name="name" required maxlength="120" value={c.name} /></div>
			<div><label class="label" for="phone">Phone</label><input class="input" id="phone" name="phone" type="tel" maxlength="20" value={c.phone ?? ''} /></div>
			<div><label class="label" for="email">Email</label><input class="input" id="email" name="email" type="email" maxlength="120" value={c.email ?? ''} /></div>
			{#if data.canSetCredit}
				<div>
					<label class="label" for="creditLimit">Credit limit ({data.user.currency})</label>
					<input class="input" id="creditLimit" name="creditLimit" type="number" step="0.01" min="0" value={(c.creditLimit / 100).toFixed(2)} />
					<p class="mt-1 text-xs text-muted">0 = they can't buy on credit. Lowering it doesn't change what they already owe.</p>
				</div>
			{/if}
			<div class="sm:col-span-2"><label class="label" for="notes">Notes</label><input class="input" id="notes" name="notes" maxlength="500" value={c.notes ?? ''} /></div>
		</div>
		<div class="flex gap-3">
			<button class="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
			<button type="button" class="btn-secondary" onclick={() => (editing = false)}>Cancel</button>
		</div>
	</form>
{:else if c.notes}
	<p class="card mb-5 p-4 text-sm"><span class="text-muted">Notes:</span> {c.notes}</p>
{/if}

<h2 class="mb-3 font-semibold">Statement</h2>
{#if data.statement.length === 0}
	<div class="card p-10 text-center text-sm text-muted">No purchases or payments yet.</div>
{:else}
	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Date</th><th>Details</th><th class="text-right">Added to account</th><th class="text-right">Paid</th><th class="text-right">Balance</th><th></th></tr></thead>
			<tbody>
				{#each data.statement as e (e.kind + e.id)}
					{#if e.kind === 'sale'}
						<tr class={e.status === 'voided' ? 'text-muted' : ''}>
							<td class="whitespace-nowrap tabular-nums">{when(e.at)}</td>
							<td>
								Sale <a href="/sales/{e.id}" class="font-mono text-xs font-medium hover:underline">{e.receiptNo}</a>
								<span class="text-muted">· {money(e.total)}</span>
								{#if e.status === 'voided'}<span class="badge ml-1 bg-red-50 text-red-700">Voided</span>
								{:else if e.status === 'refunded'}<span class="badge ml-1 bg-amber-100 text-amber-800">Refunded</span>
								{:else if e.status === 'partially_refunded'}<span class="badge ml-1 bg-amber-100 text-amber-800">Part refunded</span>
								{:else if e.change === 0}<span class="badge ml-1 bg-canvas text-muted">Paid in full</span>{/if}
							</td>
							<td class="text-right tabular-nums">{e.change ? money(e.change) : ''}</td>
							<td></td>
							<td class="text-right font-medium tabular-nums">{money(e.balance)}</td>
							<td></td>
						</tr>
					{:else if e.kind === 'refund'}
						<tr>
							<td class="whitespace-nowrap tabular-nums">{when(e.at)}</td>
							<td>
								Refund on <a href="/sales/{e.saleId}" class="font-mono text-xs font-medium hover:underline">{e.receiptNo}</a>, taken off what they owe
								<p class="text-xs text-muted">{e.reason}</p>
							</td>
							<td></td>
							<td class="text-right tabular-nums text-brand-700">{money(e.amount)}</td>
							<td class="text-right font-medium tabular-nums">{money(e.balance)}</td>
							<td></td>
						</tr>
					{:else}
						<tr class={e.voided ? 'text-muted' : ''}>
							<td class="whitespace-nowrap tabular-nums">{when(e.at)}</td>
							<td>
								Payment · {methodName(e.method)}{#if e.reference}<span class="text-xs text-muted"> · {e.reference}</span>{/if}
								{#if e.user}<span class="text-xs text-muted"> · taken by {e.user}</span>{/if}
								{#if e.voided}<span class="badge ml-1 bg-red-50 text-red-700">Cancelled</span><p class="text-xs">{e.voidReason}</p>{/if}
								{#if e.note}<p class="text-xs text-muted">{e.note}</p>{/if}
							</td>
							<td></td>
							<td class="text-right tabular-nums {e.voided ? 'line-through' : 'text-brand-700'}">{money(e.amount)}</td>
							<td class="text-right font-medium tabular-nums">{money(e.balance)}</td>
							<td class="text-right whitespace-nowrap">
								{#if !e.voided}
									<a href="/receipt/payment/{e.id}" target="_blank" class="text-muted hover:text-ink" aria-label="Print receipt"><Printer size={16} /></a>
									{#if data.canVoid}
										<button class="ml-2 text-xs text-muted hover:text-red-700" onclick={() => (voiding = voiding === e.id ? null : e.id)}>Cancel</button>
									{/if}
								{/if}
							</td>
						</tr>
						{#if voiding === e.id}
							<tr>
								<td colspan="6">
									<form method="POST" action="?/voidPayment" use:enhance={done} class="flex flex-wrap gap-2">
										<input type="hidden" name="paymentId" value={e.id} />
										<input class="input max-w-sm flex-1" name="reason" placeholder="Why? e.g. entered twice" required maxlength="300" />
										<button class="btn-danger" disabled={busy}>Cancel payment of {money(e.amount)}</button>
									</form>
								</td>
							</tr>
						{/if}
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}
