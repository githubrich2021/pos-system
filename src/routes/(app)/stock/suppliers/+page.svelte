<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { Pencil, Plus, Truck } from '@lucide/svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let adding = $state(false);
	let editing = $state<string | null>(null);
	let saving = $state(false);

	const money = (n: number) => formatMoney(n, data.user.currency);

	const submit: SubmitFunction = () => {
		saving = true;
		return async ({ result, update }) => {
			await update({ reset: result.type === 'success' });
			saving = false;
			if (result.type === 'success') {
				adding = false;
				editing = null;
			}
		};
	};
</script>

<svelte:head><title>Suppliers</title></svelte:head>

{#snippet fields(s?: (typeof data.suppliers)[number])}
	{@const key = s?.id ?? 'new'}
	<div class="grid gap-3 sm:grid-cols-2">
		<div>
			<label class="label" for="name-{key}">Name</label>
			<input class="input" id="name-{key}" name="name" required maxlength="120" value={s?.name ?? ''} />
		</div>
		<div>
			<label class="label" for="phone-{key}">Phone</label>
			<input class="input" id="phone-{key}" name="phone" type="tel" maxlength="40" value={s?.phone ?? ''} />
		</div>
		<div>
			<label class="label" for="email-{key}">Email</label>
			<input class="input" id="email-{key}" name="email" type="email" maxlength="120" value={s?.email ?? ''} />
		</div>
		<div>
			<label class="label" for="address-{key}">Address</label>
			<input class="input" id="address-{key}" name="address" maxlength="300" value={s?.address ?? ''} />
		</div>
	</div>
{/snippet}

<div class="max-w-5xl space-y-4">
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	{#if form?.success}<p class="alert-success">{form.success}</p>{/if}

	{#if adding}
		<form method="POST" action="?/create" class="card space-y-4 p-6" use:enhance={submit}>
			<h2 class="font-semibold">New supplier</h2>
			{@render fields()}
			<div class="flex gap-3">
				<button class="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add supplier'}</button>
				<button type="button" class="btn-secondary" onclick={() => (adding = false)}>Cancel</button>
			</div>
		</form>
	{:else}
		<button
			class="btn-secondary"
			onclick={() => {
				adding = true;
				editing = null;
			}}><Plus size={16} /> Add supplier</button
		>
	{/if}

	{#if data.suppliers.length === 0}
		<div class="card flex flex-col items-center p-12 text-center">
			<Truck size={32} class="text-muted" />
			<p class="mt-3 font-medium">No suppliers yet</p>
			<p class="mt-1 text-sm text-muted">Add the companies you buy stock from. You can also add one while receiving a delivery.</p>
		</div>
	{:else}
		<div class="card overflow-x-auto">
			<table class="table-base">
				<thead><tr><th>Supplier</th><th>Contact</th><th class="text-right">Deliveries</th><th class="text-right">Total bought</th><th>Last delivery</th><th></th></tr></thead>
				<tbody>
					{#each data.suppliers as s (s.id)}
						{#if editing === s.id}
							<tr>
								<td colspan="6">
									<form method="POST" action="?/update" class="space-y-4 py-2" use:enhance={submit}>
										<input type="hidden" name="id" value={s.id} />
										{@render fields(s)}
										<div class="flex gap-3">
											<button class="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
											<button type="button" class="btn-secondary" onclick={() => (editing = null)}>Cancel</button>
										</div>
									</form>
								</td>
							</tr>
						{:else}
							<tr>
								<td>
									<p class="font-medium">{s.name}</p>
									{#if s.address}<p class="text-xs text-muted">{s.address}</p>{/if}
								</td>
								<td class="text-muted">
									{#if s.phone}<a class="block hover:underline" href="tel:{s.phone}">{s.phone}</a>{/if}
									{#if s.email}<a class="block text-xs hover:underline" href="mailto:{s.email}">{s.email}</a>{/if}
									{#if !s.phone && !s.email}—{/if}
								</td>
								<td class="text-right tabular-nums">{s.deliveries}</td>
								<td class="text-right tabular-nums">{money(s.totalBought)}</td>
								<td class="text-muted">{s.lastDelivery ? new Date(s.lastDelivery).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'}</td>
								<td class="text-right">
									<button
										class="text-muted hover:text-ink"
										aria-label="Edit {s.name}"
										onclick={() => {
											editing = s.id;
											adding = false;
										}}><Pencil size={16} /></button
									>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
