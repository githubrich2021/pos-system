<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Search, Plus, Minus, Trash, CirclePause, ScanBarcode, Clock, Percent, ShoppingCart } from '@lucide/svelte';
	import PaymentDialog from '#lib/components/sell/PaymentDialog.svelte';
	import { formatMoney, toMinor } from '#lib/core/money.ts';
	import { calculateSale, roundQty, type TenderedPayment } from '#lib/core/pricing.ts';
	import { uuid } from '#lib/uuid.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Product = (typeof data.products)[number];
	interface CartLine {
		productId: string;
		name: string;
		unit: string;
		unitPrice: number;
		quantity: number;
		taxRateBp: number | null;
		taxInclusive: boolean;
	}
	interface HeldSale {
		id: string;
		at: string;
		lines: CartLine[];
		discount: number;
	}

	const HELD_KEY = 'pos.held.v1';
	const DECIMAL_UNITS = ['kg', 'g', 'litre', 'ml'];
	const money = (n: number) => formatMoney(n, data.user.currency);

	let query = $state('');
	let categoryId = $state<string | null>(null);
	let cart = $state<CartLine[]>([]);
	let discount = $state(0);
	let held = $state<HeldSale[]>([]);
	let showHeld = $state(false);
	let paying = $state(false);
	let saleId = $state(uuid());
	let notice = $state('');
	let searchInput = $state<HTMLInputElement>();

	const totals = $derived(calculateSale(cart, discount));
	const itemCount = $derived(cart.reduce((a, l) => a + (DECIMAL_UNITS.includes(l.unit) ? 1 : l.quantity), 0));

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.products.filter(
			(p) =>
				(!categoryId || p.categoryId === categoryId) &&
				(!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase() === q || p.barcode === q)
		);
	});

	function stockLeft(p: Product) {
		const inCart = cart.find((l) => l.productId === p.id)?.quantity ?? 0;
		return roundQty(p.stock - inCart);
	}

	function add(p: Product, qty = 1) {
		const line = cart.find((l) => l.productId === p.id);
		if (line) line.quantity = roundQty(line.quantity + qty);
		else
			cart.push({
				productId: p.id,
				name: p.name,
				unit: p.unit,
				unitPrice: p.price,
				quantity: qty,
				taxRateBp: p.taxRateBp,
				taxInclusive: p.taxInclusive
			});
		notice = p.trackStock && stockLeft(p) < 0 ? `${p.name}: only ${p.stock} ${p.unit} in stock` : '';
	}

	function setQty(line: CartLine, value: number) {
		if (!Number.isFinite(value) || value <= 0) return remove(line);
		line.quantity = DECIMAL_UNITS.includes(line.unit) ? roundQty(value) : Math.round(value);
	}

	function remove(line: CartLine) {
		cart.splice(cart.indexOf(line), 1);
		if (!cart.length) discount = 0;
	}

	/** Enter in the search box: a scanned barcode/SKU, or the only match, goes straight into the cart. */
	function onSearchEnter() {
		const q = query.trim();
		if (!q) return;
		const exact = data.products.find((p) => p.barcode === q || p.sku?.toLowerCase() === q.toLowerCase());
		const pick = exact ?? (filtered.length === 1 ? filtered[0] : null);
		if (pick) {
			add(pick);
			query = '';
		} else {
			notice = `No product matches "${q}"`;
		}
	}

	let editingDiscount = $state(false);
	let discountText = $state('');

	function openDiscount() {
		discountText = discount ? (discount / 100).toFixed(2) : '';
		editingDiscount = true;
	}

	/** Accepts an amount ("5" = GH₵5.00) or a percentage ("10%"). */
	function applyDiscount() {
		const v = discountText.trim();
		try {
			discount = v.endsWith('%')
				? Math.round((totals.subtotal * Math.min(100, Math.max(0, Number(v.slice(0, -1)) || 0))) / 100)
				: Math.min(totals.subtotal, Math.max(0, toMinor(v || '0')));
			editingDiscount = false;
			notice = '';
		} catch {
			notice = 'That discount is not a valid amount.';
		}
	}

	function clearCart() {
		cart = [];
		discount = 0;
		editingDiscount = false;
		notice = '';
		saleId = uuid();
	}

	// Held sales are kept on this device only
	function saveHeld() {
		try {
			localStorage.setItem(HELD_KEY, JSON.stringify(held));
		} catch {
			/* storage unavailable: held sales last until the page is closed */
		}
	}

	function hold() {
		if (!cart.length) return;
		held.unshift({ id: uuid(), at: new Date().toISOString(), lines: $state.snapshot(cart), discount });
		saveHeld();
		clearCart();
		notice = 'Sale put on hold';
	}

	function resume(h: HeldSale) {
		if (cart.length) hold();
		cart = h.lines;
		discount = h.discount;
		held = held.filter((x) => x.id !== h.id);
		saveHeld();
		showHeld = false;
		notice = '';
	}

	async function completeSale(payments: TenderedPayment[]) {
		let res: Response;
		try {
			res = await fetch('/api/sales', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					id: saleId,
					lines: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
					discount,
					payments,
					soldAt: new Date().toISOString()
				})
			});
		} catch {
			throw new Error("Can't reach the server. Check the connection and press Complete sale again — it won't be charged twice.");
		}
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.message ?? 'The sale could not be saved.');
		return body as { id: string; receiptNo: string };
	}

	async function newSale() {
		paying = false;
		clearCart();
		await invalidateAll(); // refresh stock levels
		searchInput?.focus();
	}

	function onKeydown(e: KeyboardEvent) {
		if (paying) return;
		if (e.key === 'F2') (e.preventDefault(), searchInput?.focus());
		if (e.key === 'F9' && cart.length) (e.preventDefault(), (paying = true));
	}

	onMount(() => {
		try {
			held = JSON.parse(localStorage.getItem(HELD_KEY) ?? '[]');
		} catch {
			held = [];
		}
		searchInput?.focus();
	});
</script>

<svelte:head><title>Sell</title></svelte:head>
<svelte:window onkeydown={onKeydown} />

<div class="flex flex-col gap-4 lg:h-[calc(100vh-3rem)] lg:flex-row">
	<!-- Products -->
	<section class="flex min-h-0 flex-1 flex-col">
		<div class="flex items-center gap-2">
			<div class="relative flex-1">
				<ScanBarcode size={18} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
				<input
					bind:this={searchInput}
					bind:value={query}
					onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), onSearchEnter())}
					class="input py-3 pl-10 text-base"
					placeholder="Scan a barcode or search products (F2)"
					aria-label="Search products"
					autocomplete="off"
				/>
			</div>
			<a href="/shift" class="btn-secondary py-3" title="Your shift"><Clock size={16} /><span class="hidden sm:inline">Shift</span></a>
		</div>

		{#if data.categories.length}
			<div class="mt-3 flex gap-2 overflow-x-auto pb-1">
				<button
					class="badge shrink-0 px-3 py-1.5 text-sm {categoryId === null ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line'}"
					onclick={() => (categoryId = null)}>All</button
				>
				{#each data.categories as c (c.id)}
					<button
						class="badge shrink-0 px-3 py-1.5 text-sm {categoryId === c.id ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line'}"
						onclick={() => (categoryId = c.id)}>{c.name}</button
					>
				{/each}
			</div>
		{/if}

		<div class="mt-3 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto pb-2 sm:grid-cols-3 xl:grid-cols-4">
			{#each filtered as p (p.id)}
				{@const left = stockLeft(p)}
				<button
					class="card flex min-h-28 flex-col p-3 text-left transition hover:border-brand-500 active:bg-brand-50"
					onclick={() => add(p)}
				>
					<span class="line-clamp-2 text-sm font-medium">{p.name}</span>
					<span class="mt-auto pt-2 font-semibold tabular-nums">{money(p.price)}</span>
					{#if p.trackStock}
						<span class="text-xs {left <= 0 ? 'text-red-700' : 'text-muted'}">{left} {p.unit} left</span>
					{/if}
				</button>
			{:else}
				<p class="col-span-full py-12 text-center text-sm text-muted">
					{data.products.length ? 'No products match.' : 'No products yet. Add some under Products.'}
				</p>
			{/each}
		</div>
	</section>

	<!-- Cart -->
	<section class="card flex min-h-[24rem] flex-col lg:w-[400px] lg:shrink-0">
		<header class="flex items-center justify-between border-b border-line px-4 py-3">
			<h2 class="flex items-center gap-2 font-semibold"><ShoppingCart size={18} /> Current sale</h2>
			<div class="flex gap-1">
				{#if held.length}
					<button class="btn-secondary px-3 py-1.5 text-xs" onclick={() => (showHeld = !showHeld)}>Held ({held.length})</button>
				{/if}
				{#if cart.length}
					<button class="px-2 py-1.5 text-xs text-muted hover:text-red-700" onclick={clearCart}>Clear</button>
				{/if}
			</div>
		</header>

		{#if showHeld}
			<ul class="divide-y divide-line border-b border-line bg-canvas">
				{#each held as h (h.id)}
					{@const t = calculateSale(h.lines, h.discount)}
					<li>
						<button class="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-white" onclick={() => resume(h)}>
							<span>
								<span class="font-medium">{h.lines.length} item{h.lines.length === 1 ? '' : 's'}</span>
								<span class="text-xs text-muted"> · held {new Date(h.at).toLocaleTimeString('en-GB', { timeStyle: 'short' })}</span>
							</span>
							<span class="tabular-nums">{money(t.total)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if cart.length === 0}
				<div class="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-muted">
					<Search size={28} class="mb-2" />
					Scan or tap a product to start a sale.
				</div>
			{:else}
				<ul class="divide-y divide-line">
					{#each cart as line, i (line.productId)}
						<li class="px-4 py-3">
							<div class="flex items-start justify-between gap-2">
								<p class="text-sm font-medium">{line.name}</p>
								<p class="text-sm font-semibold tabular-nums">{money(totals.lines[i]?.gross ?? 0)}</p>
							</div>
							<div class="mt-2 flex items-center justify-between">
								<p class="text-xs text-muted">{money(line.unitPrice)} / {line.unit}</p>
								<div class="flex items-center gap-1">
									<button class="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas" aria-label="Less {line.name}" onclick={() => setQty(line, line.quantity - 1)}>
										<Minus size={14} />
									</button>
									<input
										class="w-16 rounded-lg border border-line py-1 text-center text-sm tabular-nums"
										type="number"
										step={DECIMAL_UNITS.includes(line.unit) ? '0.001' : '1'}
										min="0"
										value={line.quantity}
										onchange={(e) => setQty(line, Number(e.currentTarget.value))}
										aria-label="Quantity of {line.name}"
									/>
									<button class="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas" aria-label="More {line.name}" onclick={() => setQty(line, line.quantity + 1)}>
										<Plus size={14} />
									</button>
									<button class="ml-1 grid size-8 place-items-center rounded-lg text-muted hover:text-red-700" aria-label="Remove {line.name}" onclick={() => remove(line)}>
										<Trash size={14} />
									</button>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<footer class="border-t border-line p-4">
			{#if editingDiscount}
				<form class="mb-3 flex gap-2" onsubmit={(e) => (e.preventDefault(), applyDiscount())}>
					<!-- svelte-ignore a11y_autofocus -->
					<input class="input py-2" bind:value={discountText} placeholder="Amount or 10%" aria-label="Discount" autofocus />
					<button class="btn-primary py-2">Apply</button>
					<button type="button" class="btn-secondary py-2" onclick={() => (editingDiscount = false)}>Cancel</button>
				</form>
			{/if}
			{#if notice}<p class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>{/if}
			<dl class="space-y-1 text-sm">
				<div class="flex justify-between"><dt class="text-muted">Subtotal ({itemCount} item{itemCount === 1 ? '' : 's'})</dt><dd class="tabular-nums">{money(totals.subtotal)}</dd></div>
				{#if totals.discountTotal}
					<div class="flex justify-between text-brand-700"><dt>Discount</dt><dd class="tabular-nums">−{money(totals.discountTotal)}</dd></div>
				{/if}
				{#if totals.taxTotal}
					<div class="flex justify-between text-xs text-muted"><dt>VAT included</dt><dd class="tabular-nums">{money(totals.taxTotal)}</dd></div>
				{/if}
				<div class="flex justify-between pt-1 text-xl font-semibold"><dt>Total</dt><dd class="tabular-nums">{money(totals.total)}</dd></div>
			</dl>
			<div class="mt-4 grid grid-cols-[auto_auto_1fr] gap-2">
				<button class="btn-secondary px-3" onclick={hold} disabled={!cart.length} title="Hold sale"><CirclePause size={18} /><span class="sr-only">Hold</span></button>
				{#if data.canDiscount}
					<button class="btn-secondary px-3" onclick={openDiscount} disabled={!cart.length} title="Discount"><Percent size={18} /><span class="sr-only">Discount</span></button>
				{:else}
					<span></span>
				{/if}
				<button class="btn-primary h-12 text-base" onclick={() => (paying = true)} disabled={!cart.length}>
					Pay {money(totals.total)}
				</button>
			</div>
		</footer>
	</section>
</div>

{#if paying}
	<PaymentDialog
		total={totals.total}
		currency={data.user.currency}
		onComplete={completeSale}
		onClose={() => (paying = false)}
		onNewSale={newSale}
	/>
{/if}
