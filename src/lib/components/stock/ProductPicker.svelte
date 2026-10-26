<script lang="ts" module>
	export interface PickerProduct {
		id: string;
		name: string;
		sku: string | null;
		barcode: string | null;
		unit: string;
		stock: number;
	}
</script>

<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { formatQty } from '#lib/core/stock.ts';

	let {
		products,
		onpick,
		placeholder = 'Search name, SKU or scan barcode',
		autofocus = false
	}: {
		products: PickerProduct[];
		onpick: (p: PickerProduct) => void;
		placeholder?: string;
		autofocus?: boolean;
	} = $props();

	let query = $state('');
	let active = $state(0);
	let input: HTMLInputElement;

	const matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return products
			.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase() === q || p.barcode === query.trim())
			.slice(0, 8);
	});

	function pick(p: PickerProduct) {
		onpick(p);
		query = '';
		active = 0;
		input.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(active + 1, matches.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			// A scanner types the barcode then presses Enter: prefer an exact code match
			const q = query.trim();
			const exact = products.find((p) => p.barcode === q || p.sku?.toLowerCase() === q.toLowerCase());
			const choice = exact ?? matches[active];
			if (choice) pick(choice);
		} else if (e.key === 'Escape') {
			query = '';
		}
	}
</script>

<div class="relative">
	<Search size={16} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:this={input}
		bind:value={query}
		oninput={() => (active = 0)}
		{onkeydown}
		{placeholder}
		{autofocus}
		class="input pl-9"
		role="combobox"
		aria-expanded={matches.length > 0}
		aria-controls="product-picker-list"
		aria-autocomplete="list"
		autocomplete="off"
	/>
	{#if matches.length}
		<ul id="product-picker-list" role="listbox" class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg">
			{#each matches as p, i (p.id)}
				<li role="option" aria-selected={i === active}>
					<button
						type="button"
						class="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm {i === active ? 'bg-brand-50' : 'hover:bg-canvas'}"
						onmouseenter={() => (active = i)}
						onclick={() => pick(p)}
					>
						<span class="min-w-0">
							<span class="block truncate font-medium">{p.name}</span>
							{#if p.sku || p.barcode}<span class="block font-mono text-xs text-muted">{p.sku ?? p.barcode}</span>{/if}
						</span>
						<span class="shrink-0 text-xs text-muted tabular-nums">{formatQty(p.stock)} {p.unit}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if query.trim()}
		<p class="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-muted shadow-lg">
			No stock-tracked product matches "{query.trim()}"
		</p>
	{/if}
</div>
