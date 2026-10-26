<script lang="ts">
	import { onMount } from 'svelte';
	import { Banknote, Smartphone, CreditCard, Landmark, HandCoins, X, Trash, CircleCheck, Printer } from '@lucide/svelte';
	import type { TillCustomer } from './CustomerSelect.svelte';
	import { formatMoney, toMinor } from '#lib/core/money.ts';
	import { PAYMENT_METHODS, settlePayments, type PaymentMethod, type TenderedPayment } from '#lib/core/pricing.ts';

	interface Props {
		total: number;
		currency: string;
		/** Saves the sale. Resolves with the receipt, or throws an Error with a message for the cashier. */
		onComplete: (payments: TenderedPayment[]) => Promise<{ id: string; receiptNo: string }>;
		onClose: () => void;
		onNewSale: () => void;
		/** The customer on the sale. "Pay later" is offered only if they have credit. */
		customer?: TillCustomer | null;
	}
	let { total, currency, onComplete, onClose, onNewSale, customer = null }: Props = $props();

	const icons = { cash: Banknote, momo: Smartphone, card: CreditCard, bank: Landmark, credit: HandCoins };
	const methods = $derived(
		(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).filter((m) => m !== 'credit' || (customer && customer.creditLimit > 0))
	);
	const money = (n: number) => formatMoney(n, currency);

	let payments = $state<TenderedPayment[]>([]);
	let method = $state<PaymentMethod>('cash');
	let amount = $state('');
	let reference = $state('');
	let saving = $state(false);
	let error = $state('');
	let done = $state<{ id: string; receiptNo: string; change: number; credit: number } | null>(null);
	let amountInput = $state<HTMLInputElement>();

	const settled = $derived(settlePayments(total, payments));
	const creditUsed = $derived(payments.filter((p) => p.method === 'credit').reduce((a, p) => a + p.amount, 0));
	const creditLeft = $derived(Math.max(0, (customer?.available ?? 0) - creditUsed));
	const canFinish = $derived(payments.length > 0 && !settled.error);

	// Quick cash buttons: exact amount, then the next round notes above it
	const quickCash = $derived.by(() => {
		const due = settled.remaining;
		if (due <= 0) return [];
		const options = new Set<number>([due]);
		for (const note of [500, 1000, 2000, 5000, 10000, 20000]) {
			const rounded = Math.ceil(due / note) * note;
			if (rounded > due) options.add(rounded);
		}
		return [...options].sort((a, b) => a - b).slice(0, 5);
	});

	function pick(m: PaymentMethod) {
		method = m;
		const max = m === 'credit' ? Math.min(settled.remaining, creditLeft) : settled.remaining;
		amount = max > 0 ? (max / 100).toFixed(2) : '';
		reference = '';
		error = '';
		queueMicrotask(() => amountInput?.select());
	}

	function add(value?: number) {
		error = '';
		let minor: number;
		try {
			minor = value ?? toMinor(amount);
		} catch {
			error = 'Enter a valid amount.';
			return;
		}
		if (minor <= 0) {
			error = 'Enter an amount above zero.';
			return;
		}
		if (method === 'credit' && minor > creditLeft) {
			error = `${customer?.name ?? 'This customer'} only has ${money(creditLeft)} of credit left.`;
			return;
		}
		if (method !== 'cash' && minor > settled.remaining) {
			error = `${PAYMENT_METHODS[method]} cannot be more than the ${money(settled.remaining)} still owed.`;
			return;
		}
		payments.push({ method, amount: minor, reference: reference.trim() || undefined });
		reference = '';
		amount = settled.remaining > 0 ? (settled.remaining / 100).toFixed(2) : '';
	}

	async function finish() {
		if (!canFinish || saving) return;
		saving = true;
		error = '';
		try {
			const result = await onComplete($state.snapshot(payments));
			done = { ...result, change: settled.change, credit: creditUsed };
		} catch (e) {
			error = e instanceof Error ? e.message : 'The sale could not be saved.';
		} finally {
			saving = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !saving) (done ? onNewSale : onClose)();
		else if (e.key === 'Enter' && done) onNewSale();
	}

	onMount(() => pick('cash'));
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Payment">
	<div class="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
		{#if done}
			<div class="p-8 text-center">
				<CircleCheck size={48} class="mx-auto text-brand-600" />
				<p class="mt-3 text-sm text-muted">Sale complete · {done.receiptNo}</p>
				{#if done.change > 0}
					<p class="mt-6 text-sm font-medium text-muted uppercase">Change due</p>
					<p class="text-5xl font-semibold tabular-nums">{money(done.change)}</p>
				{:else}
					<p class="mt-4 text-2xl font-semibold">{money(total)}</p>
				{/if}
				{#if done.credit > 0 && customer}
					<p class="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
						{money(done.credit)} added to {customer.name}'s account. They now owe {money(customer.balance + done.credit)}.
					</p>
				{/if}
				<div class="mt-8 grid grid-cols-2 gap-3">
					<a href="/receipt/{done.id}?print=1" target="_blank" class="btn-secondary"><Printer size={16} /> Print receipt</a>
					<button class="btn-primary" onclick={onNewSale}>New sale</button>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-between border-b border-line px-6 py-4">
				<div>
					<p class="text-sm text-muted">Total to pay</p>
					<p class="text-3xl font-semibold tabular-nums">{money(total)}</p>
				</div>
				<button class="rounded-lg p-2 text-muted hover:bg-canvas" onclick={onClose} aria-label="Close" disabled={saving}><X size={20} /></button>
			</div>

			<div class="space-y-5 p-6">
				<div class="grid gap-2" style="grid-template-columns: repeat({methods.length}, minmax(0, 1fr))">
					{#each methods as key (key)}
						{@const Icon = icons[key]}
						{@const label = PAYMENT_METHODS[key]}
						<button
							type="button"
							class="flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium {method === key
								? 'border-brand-500 bg-brand-50 text-brand-700'
								: 'border-line text-ink hover:bg-canvas'}"
							onclick={() => pick(key)}
							disabled={settled.remaining === 0 || (key === 'credit' && creditLeft === 0)}
						>
							<Icon size={20} />
							{label}
						</button>
					{/each}
				</div>

				{#if settled.remaining > 0}
					<form class="space-y-3" onsubmit={(e) => (e.preventDefault(), add())}>
						<div class="flex gap-2">
							<input
								bind:this={amountInput}
								bind:value={amount}
								class="input text-lg tabular-nums"
								type="number"
								step="0.01"
								min="0"
								inputmode="decimal"
								aria-label="Amount"
							/>
							<button class="btn-primary whitespace-nowrap">Add {PAYMENT_METHODS[method]}</button>
						</div>
						{#if method === 'credit' && customer}
							<p class="text-sm text-muted">
								{customer.name} can take up to <span class="font-medium text-ink">{money(creditLeft)}</span> more on credit
								{#if customer.balance > 0}(already owes {money(customer.balance)}){/if}.
							</p>
						{:else if method !== 'cash'}
							<input
								bind:value={reference}
								class="input"
								placeholder={method === 'momo' ? 'MoMo transaction ID (optional)' : 'Reference (optional)'}
							/>
						{:else if quickCash.length}
							<div class="flex flex-wrap gap-2">
								{#each quickCash as q (q)}
									<button type="button" class="btn-secondary px-3 py-1.5 tabular-nums" onclick={() => add(q)}>{money(q)}</button>
								{/each}
							</div>
						{/if}
					</form>
				{/if}

				{#if payments.length}
					<ul class="divide-y divide-line rounded-lg border border-line text-sm">
						{#each payments as p, i (i)}
							<li class="flex items-center justify-between px-3 py-2">
								<span>{PAYMENT_METHODS[p.method]}{#if p.reference}<span class="text-xs text-muted"> · {p.reference}</span>{/if}</span>
								<span class="flex items-center gap-2 tabular-nums">
									{money(p.amount)}
									<button type="button" class="text-muted hover:text-red-700" aria-label="Remove payment" onclick={() => payments.splice(i, 1)}>
										<Trash size={14} />
									</button>
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				<dl class="space-y-1 text-sm">
					<div class="flex justify-between"><dt class="text-muted">Paid</dt><dd class="tabular-nums">{money(settled.paid)}</dd></div>
					{#if settled.remaining > 0}
						<div class="flex justify-between font-medium"><dt>Still owed</dt><dd class="tabular-nums">{money(settled.remaining)}</dd></div>
					{:else}
						<div class="flex justify-between text-lg font-semibold"><dt>Change</dt><dd class="tabular-nums">{money(settled.change)}</dd></div>
					{/if}
				</dl>

				{#if error}<p class="alert-error">{error}</p>{/if}

				<button class="btn-primary h-14 w-full text-base" disabled={!canFinish || saving} onclick={finish}>
					{saving ? 'Saving…' : 'Complete sale'}
				</button>
			</div>
		{/if}
	</div>
</div>
