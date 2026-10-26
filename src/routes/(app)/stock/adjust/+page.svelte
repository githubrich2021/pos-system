<script lang="ts">
	import { enhance } from '$app/forms';
	import { X } from '@lucide/svelte';
	import ProductPicker, { type PickerProduct } from '#lib/components/stock/ProductPicker.svelte';
	import { ADJUST_REASONS, formatQty } from '#lib/core/stock.ts';
	import { roundQty } from '#lib/core/pricing.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let product = $state<PickerProduct | null>(null);
	let reason = $state<string>('damage');
	let direction = $state<'in' | 'out'>('out');
	let quantity = $state('');
	let note = $state('');
	let saving = $state(false);

	$effect.pre(() => {
		if (data.preselect && !product) product = data.products.find((p) => p.id === data.preselect) ?? null;
	});

	const reasonInfo = $derived(ADJUST_REASONS.find((r) => r.key === reason)!);
	// Damage, expiry and loss always take stock away
	$effect(() => {
		if (reasonInfo.direction === 'out') direction = 'out';
	});

	const qty = $derived(Number(quantity));
	const after = $derived(
		product && quantity && Number.isFinite(qty) ? roundQty(product.stock + (direction === 'out' ? -qty : qty)) : null
	);
</script>

<svelte:head><title>Adjust stock</title></svelte:head>

<form
	method="POST"
	class="max-w-2xl space-y-5"
	use:enhance={() => {
		saving = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success') {
				product = null;
				quantity = '';
				note = '';
			}
		};
	}}
>
	<div>
		<h2 class="text-lg font-semibold">Adjust stock</h2>
		<p class="text-sm text-muted">Record damaged, expired or missing items, or correct a wrong count. To add stock from a supplier, use <a class="font-medium text-brand-600 hover:underline" href="/stock/purchases/new">Receive stock</a>.</p>
	</div>

	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	{#if form?.success}<p class="alert-success">{form.success}</p>{/if}

	<section class="card space-y-4 p-6">
		<div>
			<p class="label">Product</p>
			{#if product}
				<input type="hidden" name="productId" value={product.id} />
				<div class="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
					<div>
						<p class="font-medium">{product.name}</p>
						<p class="text-sm text-muted">In stock now: <span class="font-medium text-ink tabular-nums">{formatQty(product.stock)} {product.unit}</span></p>
					</div>
					<button type="button" class="text-muted hover:text-ink" aria-label="Choose another product" onclick={() => (product = null)}><X size={18} /></button>
				</div>
			{:else}
				<ProductPicker products={data.products} onpick={(p) => (product = p)} autofocus />
			{/if}
		</div>

		<fieldset>
			<legend class="label">Reason</legend>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each ADJUST_REASONS as r (r.key)}
					<label class="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm {reason === r.key ? 'border-brand-500 bg-brand-50' : 'border-line'}">
						<input type="radio" name="reason" value={r.key} bind:group={reason} class="accent-brand-600" />
						{r.label}
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<p class="label">Change</p>
				<input type="hidden" name="direction" value={direction} />
				<div class="flex rounded-xl border border-line p-1">
					<button type="button" class="flex-1 rounded-lg py-1.5 text-sm font-medium {direction === 'out' ? 'bg-red-50 text-red-700' : 'text-muted'}" onclick={() => (direction = 'out')}>Remove</button>
					<button
						type="button"
						class="flex-1 rounded-lg py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 {direction === 'in' ? 'bg-brand-50 text-brand-700' : 'text-muted'}"
						disabled={reasonInfo.direction === 'out'}
						onclick={() => (direction = 'in')}>Add</button
					>
				</div>
			</div>
			<div>
				<label class="label" for="quantity">Quantity{product ? ` (${product.unit})` : ''}</label>
				<input class="input" id="quantity" name="quantity" type="number" step="0.001" min="0" required bind:value={quantity} />
			</div>
		</div>

		<div>
			<label class="label" for="note">Note {reason === 'adjustment' ? '' : '(optional)'}</label>
			<input class="input" id="note" name="note" maxlength="300" bind:value={note} required={reason === 'adjustment'} placeholder={reason === 'adjustment' ? 'What was wrong with the count?' : 'e.g. Broken in transit'} />
		</div>

		{#if after !== null && product}
			<p class="text-sm">
				Stock will go from <span class="font-medium tabular-nums">{formatQty(product.stock)}</span> to
				<span class="font-semibold tabular-nums {after < 0 ? 'text-red-700' : ''}">{formatQty(after)} {product.unit}</span>
				{#if after < 0}<span class="text-red-700"> — that's below zero. Check the quantity.</span>{/if}
			</p>
		{/if}
	</section>

	<div class="flex gap-3">
		<button class="btn-primary" disabled={saving || !product}>{saving ? 'Saving…' : 'Save adjustment'}</button>
		<a href="/stock" class="btn-secondary">Back to stock</a>
	</div>
</form>
