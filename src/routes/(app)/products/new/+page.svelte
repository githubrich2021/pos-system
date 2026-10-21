<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { enabledModules } from '#lib/modules/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
	const v = $derived<Record<string, string>>(form?.values ?? {});
	const moduleFields = $derived(
		enabledModules(data.user.modules).flatMap((m) => m.productFields.map((f) => ({ ...f, module: m.name })))
	);
</script>

<svelte:head><title>Add product</title></svelte:head>

<PageHeader title="Add product" subtitle="Prices are in {data.user.currency}." />

<form
	method="POST"
	class="max-w-3xl space-y-6"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}

	<section class="card space-y-4 p-6">
		<h2 class="font-semibold">Details</h2>
		<div>
			<label class="label" for="name">Name</label>
			<input class="input" id="name" name="name" required value={v.name ?? ''} />
		</div>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label class="label" for="category">Category</label>
				<input class="input" id="category" name="category" list="categories" value={v.category ?? ''} />
				<datalist id="categories">
					{#each data.categories as c}<option value={c}></option>{/each}
				</datalist>
			</div>
			<div>
				<label class="label" for="sku">SKU</label>
				<input class="input" id="sku" name="sku" value={v.sku ?? ''} />
			</div>
			<div>
				<label class="label" for="barcode">Barcode</label>
				<input class="input" id="barcode" name="barcode" value={v.barcode ?? ''} placeholder="Scan or type" />
			</div>
		</div>
	</section>

	<section class="card space-y-4 p-6">
		<h2 class="font-semibold">Pricing</h2>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label class="label" for="sellPrice">Selling price</label>
				<input class="input" id="sellPrice" name="sellPrice" type="number" step="0.01" min="0" required value={v.sellPrice ?? ''} />
			</div>
			<div>
				<label class="label" for="costPrice">Cost price</label>
				<input class="input" id="costPrice" name="costPrice" type="number" step="0.01" min="0" value={v.costPrice ?? ''} />
			</div>
			<div>
				<label class="label" for="taxRateId">Tax</label>
				<select class="input" id="taxRateId" name="taxRateId">
					<option value="">No tax</option>
					{#each data.taxRates as t}
						<option value={t.id} selected={v.taxRateId ? v.taxRateId === t.id : true}>{t.name} ({t.rateBp / 100}%)</option>
					{/each}
				</select>
			</div>
		</div>
	</section>

	<section class="card space-y-4 p-6">
		<h2 class="font-semibold">Stock</h2>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" name="trackStock" checked={form ? v.trackStock === 'on' : true} class="accent-brand-600" />
			Track stock for this product
		</label>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label class="label" for="unit">Unit</label>
				<select class="input" id="unit" name="unit">
					{#each ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'pack', 'bottle', 'service'] as u}
						<option selected={(v.unit ?? 'pcs') === u}>{u}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label" for="openingStock">Opening stock</label>
				<input class="input" id="openingStock" name="openingStock" type="number" step="0.001" value={v.openingStock ?? ''} />
			</div>
			<div>
				<label class="label" for="lowStockLevel">Alert when stock is at or below</label>
				<input class="input" id="lowStockLevel" name="lowStockLevel" type="number" step="0.001" min="0" value={v.lowStockLevel ?? ''} />
			</div>
		</div>
	</section>

	{#if moduleFields.length}
		<section class="card space-y-4 p-6">
			<h2 class="font-semibold">Extra details</h2>
			<p class="-mt-2 text-sm text-muted">Added by your switched-on business modules.</p>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each moduleFields as f (f.key)}
					{#if f.type === 'boolean'}
						<label class="flex items-center gap-2 self-end pb-2.5 text-sm">
							<input type="checkbox" name="cf_{f.key}" checked={v[`cf_${f.key}`] === 'on'} class="accent-brand-600" />
							{f.label} <span class="text-xs text-muted">· {f.module}</span>
						</label>
					{:else}
						<div>
							<label class="label" for="cf_{f.key}">{f.label} <span class="font-normal text-muted">· {f.module}</span></label>
							<input
								class="input"
								id="cf_{f.key}"
								name="cf_{f.key}"
								type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'date' ? 'date' : 'text'}
								step={f.type === 'money' ? '0.01' : f.type === 'number' ? 'any' : undefined}
								value={v[`cf_${f.key}`] ?? ''}
							/>
						</div>
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	<div class="flex gap-3">
		<button class="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
		<a href="/products" class="btn-secondary">Cancel</a>
	</div>
</form>
