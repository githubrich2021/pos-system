<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	let { title, subtitle, actions }: { title: string; subtitle?: string; actions?: Snippet } = $props();

	const user = $derived(page.data.user as { name: string; roleName: string } | undefined);
</script>

<header class="card mb-5 flex flex-wrap items-center justify-between gap-4 px-6 py-4 print:hidden">
	<div class="min-w-0">
		<h1 class="text-xl font-semibold tracking-tight">{title}</h1>
		{#if subtitle}<p class="mt-0.5 text-sm text-muted">{subtitle}</p>{/if}
	</div>
	<div class="flex flex-wrap items-center gap-3">
		{#if actions}<div class="flex flex-wrap gap-2">{@render actions()}</div>{/if}
		{#if user}
			<div class="hidden items-center gap-2.5 rounded-full border border-line py-1 pr-4 pl-1 sm:flex">
				<span class="grid size-8 place-items-center rounded-full bg-forest text-sm font-semibold text-lime">
					{user.name.charAt(0).toUpperCase()}
				</span>
				<div class="leading-tight">
					<p class="text-sm font-medium">{user.name}</p>
					<p class="text-xs text-muted">{user.roleName}</p>
				</div>
			</div>
		{/if}
	</div>
</header>
