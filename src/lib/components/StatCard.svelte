<script lang="ts">
	import type { Component } from 'svelte';

	let {
		label,
		value,
		icon: Icon,
		note,
		highlight = false,
		warn = false
	}: {
		label: string;
		value: string | number;
		icon: Component;
		/** Small text under the number, e.g. "Since yesterday" */
		note?: string;
		/** The dark green card — use for the most important number on the page */
		highlight?: boolean;
		warn?: boolean;
	} = $props();
</script>

<div class="flex items-center gap-4 rounded-2xl p-5 {highlight ? 'bg-forest text-white' : 'bg-white'}">
	<span
		class="grid size-12 shrink-0 place-items-center rounded-full {highlight
			? 'bg-lime text-forest'
			: warn
				? 'bg-amber-50 text-amber-600'
				: 'bg-brand-50 text-brand-600'}"
	>
		<Icon size={20} />
	</span>
	<div class="min-w-0">
		<p class="text-sm {highlight ? 'text-white/75' : 'text-muted'}">{label}</p>
		<p class="mt-1 truncate text-2xl font-semibold tabular-nums {warn && !highlight ? 'text-amber-600' : ''}">{value}</p>
		{#if note}<p class="mt-0.5 text-xs {highlight ? 'text-white/60' : 'text-muted'}">{note}</p>{/if}
	</div>
</div>
