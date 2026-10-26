<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import ProductPicker, { type PickerProduct } from '#lib/components/stock/ProductPicker.svelte';
	import { formatMoney, fromMinor, toMinor } from '#lib/core/money.ts';
	import { formatQty } from '#lib/core/stock.ts';
	import { uuid } from '#lib/uuid.ts';
	import type { PageProps } from './$types';

	type Product = PageProps['data']['products'][number];
	interface Line {
		product: Product;
		quantity: string;
		/** In cedis, as typed. */
		unitCost: string;
	}

	let { data, form }: PageProps = $props();

	// Made once per delivery, so submitting twice can't record it twice
	const purchaseId = uuid();
	let lines = $state<Line[]>([]);
	let supplierId = $state('');
	let newSupplierName = $state('');
	let reference = $state('');
	let note = $state('');
	let updateCostPrices = $state(true);
	let saving = $state(false);
	let error = $state('');

	const money = (n: number) => formatMoney(n, data.user.currency);
	const toNumber = (s: string) => (s.trim() === '' ? NaN : Number(s));
	const lineTotal = (l: Line) => {
		const q = toNumber(l.quantity);
		const c = toNumber(l.unitCost);
		return Number.isFinite(q) && Number.isFinite(c) ? Math.round(q * toMinor(c)) : 0;
	};
	const total = $derived(lines.reduce((sum, l) => sum + lineTotal(l), 0));

	function add(p: PickerProduct) {
		const existing = lines.find((l) => l.product.id === p.id);
		if (existing) {
			existing.quantity = String((toNumber(existing.quantity) || 0) + 1);
			return;
		}
		const product = data.products.find((x) => x.id === p.id)!;
		lines.push({ product, quantity: '1', unitCost: String(fromMinor(product.costPrice)) });
	}

	const payload = $derived(
		JSON.stringify({
			id: purchaseId,
			supplierId: supplierId && supplierId !== 'new' ? supplierId : null,
			newSupplierName: supplierId === 'new' ? newSupplierName : '',
			reference,
			note,
			updateCostPrices,
			lines: lines.map((l) => ({
				productId: l.product.id,
				quantity: toNumber(l.quantity),
				unitCost: Number.isFinite(toNumber(l.unitCost)) ? toMinor(toNumber(l.unitCost)) : NaN
			}))
		})
	);
</script>

<svelte:head><title>Receive stock</title></svelte:head>

<form
	method="POST"
	class="max-w-5xl space-y-5"
	use:enhance={({ cancel }) => {
		error = '';
		if (lines.length === 0) {
			error = 'Add at least one product.';
			return cancel();
		}
		if (supplierId === 'new' && !newSupplierName.trim()) {
			error = 'Enter the new supplier’s name.';
			return cancel();
		}
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<input type="hidden" name="payload" value={payload} />

	<div>
		<h2 class="text-lg font-semibold">Receive stock</h2>
		<p class="text-sm text-muted">Record a delivery from a supplier. The stock is added as soon as you save.</p>
	</div>

	{#if error || form?.message}<p class="alert-error">{error || form?.message}</p>{/if}

	<section class="card grid gap-4 p-6 sm:grid-cols-3">
		<div>
			<label class="label" for="supplier">Supplier</label>
			<select id="supplier" class="input" bind:value={supplierId}>
				<option value="">No supplier</option>
				{#each data.suppliers as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				<option value="new">+ New supplier…</option>
			</select>
			{#if supplierId === 'new'}
				<!-- svelte-ignore a11y_autofocus -->
				<input class="input mt-2" placeholder="Supplier name" maxlength="120" bind:value={newSupplierName} autofocus />
			{/if}
		</div>
		<div>
			<label class="label" for="reference">Invoice / waybill no.</label>
			<input id="reference" class="input" maxlength="100" bind:value={reference} />
		</div>
		<div>
			<label class="label" for="note">Note</label>
			<input id="note" class="input" maxlength="500" bind:value={note} />
		</div>
	</section>

	<section class="card space-y-4 p-6">
		<div class="max-w-md">
			<p class="label">Add products</p>
			<ProductPicker products={data.products} onpick={add} autofocus />
		</div>

		{#if lines.length}
			<div class="overflow-x-auto">
				<table class="table-base">
					<thead>
						<tr><th>Product</th><th class="w-32">Quantity</th><th class="w-40">Cost each ({data.user.currency})</th><th class="text-right">Line total</th><th class="w-10"></th></tr>
					</thead>
					<tbody>
						{#each lines as line, i (line.product.id)}
							{@const costChanged = line.unitCost.trim() !== '' && toMinor(toNumber(line.unitCost) || 0) !== line.product.costPrice}
							<tr>
								<td>
									<p class="font-medium">{line.product.name}</p>
									<p class="text-xs text-muted">In stock: {formatQty(line.product.stock)} {line.product.unit}</p>
								</td>
								<td>
									<div class="flex items-center gap-1.5">
										<input class="input py-1.5" type="number" step="0.001" min="0" required bind:value={line.quantity} aria-label="Quantity of {line.product.name}" />
										<span class="text-xs text-muted">{line.product.unit}</span>
									</div>
								</td>
								<td>
									<input class="input py-1.5" type="number" step="0.01" min="0" required bind:value={line.unitCost} aria-label="Cost of {line.product.name}" />
									{#if costChanged}<p class="mt-1 text-xs text-amber-700">Was {money(line.product.costPrice)}</p>{/if}
								</td>
								<td class="text-right font-medium tabular-nums">{money(lineTotal(line))}</td>
								<td>
									<button type="button" class="text-muted hover:text-red-700" aria-label="Remove {line.product.name}" onclick={() => lines.splice(i, 1)}>
										<Trash2 size={16} />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" class="accent-brand-600" bind:checked={updateCostPrices} />
					Update product cost prices to these costs
				</label>
				<p class="text-lg">Total <span class="ml-2 font-semibold tabular-nums">{money(total)}</span></p>
			</div>
		{:else}
			<p class="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Search or scan products above to add them to this delivery.</p>
		{/if}
	</section>

	<div class="flex gap-3">
		<button class="btn-primary" disabled={saving || lines.length === 0}>{saving ? 'Saving…' : 'Save delivery'}</button>
		<a href="/stock/purchases" class="btn-secondary">Cancel</a>
	</div>
</form>
