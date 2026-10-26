<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney } from '#lib/core/money.ts';
	import { lineRefund, roundQty } from '#lib/core/pricing.ts';
	import { uuid } from '#lib/uuid.ts';

	interface Line {
		saleItemId: string;
		name: string;
		unit: string;
		decimal: boolean;
		sold: number;
		refundedQty: number;
		remaining: number;
		lineTotal: number;
		tax: number;
		refundedAmount: number;
		refundedTax: number;
	}

	let {
		lines,
		payableLeft,
		customer,
		hasShift,
		currency,
		onCancel
	}: {
		lines: Line[];
		/** Most money that can still be paid out on this sale. */
		payableLeft: number;
		/** The sale's customer and what they owe, if any. */
		customer: { name: string; balance: number } | null;
		hasShift: boolean;
		currency: string;
		onCancel: () => void;
	} = $props();

	const money = (n: number) => formatMoney(n, currency);
	const METHODS = [
		{ key: 'cash', label: 'Cash' },
		{ key: 'momo', label: 'Mobile money' },
		{ key: 'card', label: 'Card' },
		{ key: 'bank', label: 'Bank transfer' },
		{ key: 'account', label: 'Take off what they owe' }
	] as const;

	// Made once per refund, so submitting twice can't refund twice
	const refundId = uuid();
	let qty = $state<Record<string, string>>({});
	let restock = $state<Record<string, boolean>>({});
	let method = $state<(typeof METHODS)[number]['key']>('cash');
	let reason = $state('');
	let reference = $state('');
	let saving = $state(false);

	$effect.pre(() => {
		for (const l of lines) {
			qty[l.saleItemId] ??= '';
			restock[l.saleItemId] ??= true;
		}
	});

	const open = $derived(lines.filter((l) => l.remaining > 0));
	const methods = $derived(METHODS.filter((m) => m.key !== 'account' || (customer && customer.balance > 0)));

	const picked = $derived(
		open
			.map((l) => {
				const q = roundQty(Number(qty[l.saleItemId] || 0));
				const valid = Number.isFinite(q) && q >= 0 && q <= l.remaining && (l.decimal || Number.isInteger(q));
				return { line: l, q, valid, ...(valid && q > 0 ? lineRefund(l, q) : { amount: 0, tax: 0 }) };
			})
			.filter((p) => p.q !== 0 || !p.valid)
	);
	const invalid = $derived(picked.find((p) => !p.valid));
	const amount = $derived(picked.reduce((a, p) => a + p.amount, 0));

	const problem = $derived.by(() => {
		if (invalid) return `Check the quantity for ${invalid.line.name} (up to ${invalid.line.remaining} ${invalid.line.unit}).`;
		if (method === 'cash' && !hasShift) return 'Open your shift first, so the cash taken from the drawer is recorded.';
		if (method === 'account' && customer && amount > customer.balance) return `${customer.name} only owes ${money(customer.balance)}.`;
		if (method !== 'account' && amount > payableLeft) {
			return `Only ${money(payableLeft)} of this sale was paid${customer ? '. Take the rest off what the customer owes.' : '.'}`;
		}
		return '';
	});

	const payload = $derived(
		JSON.stringify({
			id: refundId,
			method,
			reason,
			reference,
			lines: picked.filter((p) => p.valid && p.q > 0).map((p) => ({ saleItemId: p.line.saleItemId, quantity: p.q, restock: restock[p.line.saleItemId] }))
		})
	);

	function all() {
		for (const l of open) qty[l.saleItemId] = String(l.remaining);
	}
</script>

<form
	method="POST"
	action="?/refund"
	class="card mb-6 space-y-5 border border-amber-200 p-5"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<input type="hidden" name="payload" value={payload} />
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h2 class="font-semibold">Refund items</h2>
			<p class="text-sm text-muted">Enter how many of each item the customer is returning.</p>
		</div>
		<button type="button" class="btn-secondary py-1.5 text-sm" onclick={all}>Refund everything left</button>
	</div>

	<div class="overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Item</th><th class="text-right">Can return</th><th class="w-32">Returning</th><th>Back in stock?</th><th class="text-right">Refund</th></tr></thead>
			<tbody>
				{#each lines as l (l.saleItemId)}
					{@const p = picked.find((x) => x.line.saleItemId === l.saleItemId)}
					<tr class={l.remaining === 0 ? 'text-muted' : ''}>
						<td>
							<p class="font-medium">{l.name}</p>
							{#if l.refundedQty > 0}<p class="text-xs text-muted">{l.refundedQty} of {l.sold} already refunded</p>{/if}
						</td>
						<td class="text-right tabular-nums">{l.remaining} {l.unit}</td>
						<td>
							{#if l.remaining > 0}
								<input
									class="input py-1.5 tabular-nums {p && !p.valid ? 'border-red-400' : ''}"
									type="number"
									min="0"
									max={l.remaining}
									step={l.decimal ? '0.001' : '1'}
									placeholder="0"
									bind:value={qty[l.saleItemId]}
									aria-label="Quantity of {l.name} returned"
								/>
							{:else}—{/if}
						</td>
						<td>
							{#if l.remaining > 0}
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" class="accent-brand-600" bind:checked={restock[l.saleItemId]} />
									{restock[l.saleItemId] ? 'Yes' : 'No, damaged'}
								</label>
							{/if}
						</td>
						<td class="text-right tabular-nums">{p?.amount ? money(p.amount) : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<fieldset>
			<legend class="label">How does the money go back?</legend>
			<div class="flex flex-wrap gap-2">
				{#each methods as m (m.key)}
					<button
						type="button"
						class="rounded-lg border px-3 py-2 text-sm font-medium {method === m.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line hover:bg-canvas'}"
						onclick={() => (method = m.key)}>{m.label}</button
					>
				{/each}
			</div>
			{#if method === 'account' && customer}
				<p class="mt-2 text-xs text-muted">{customer.name} owes {money(customer.balance)}. The refund will be taken off that.</p>
			{/if}
		</fieldset>
		<div class="space-y-3">
			<div>
				<label class="label" for="refund-reason">Reason</label>
				<input id="refund-reason" class="input" bind:value={reason} required maxlength="300" placeholder="e.g. wrong size, expired, faulty" />
			</div>
			{#if method !== 'cash' && method !== 'account'}
				<div>
					<label class="label" for="refund-ref">Reference (optional)</label>
					<input id="refund-ref" class="input" bind:value={reference} maxlength="100" placeholder={method === 'momo' ? 'MoMo transaction ID' : ''} />
				</div>
			{/if}
		</div>
	</div>

	{#if problem && amount > 0}<p class="alert-error">{problem}</p>{/if}

	<div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
		<p class="text-lg">Refund <span class="ml-1 font-semibold tabular-nums">{money(amount)}</span></p>
		<div class="flex gap-3">
			<button type="button" class="btn-secondary" onclick={onCancel}>Cancel</button>
			<button class="btn-danger" disabled={saving || !picked.some((p) => p.q > 0) || !!problem || !reason.trim()}>
				{saving ? 'Refunding…' : `Refund ${money(amount)}`}
			</button>
		</div>
	</div>
</form>
