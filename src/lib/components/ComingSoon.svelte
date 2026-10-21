<script lang="ts">
	import type { PosModule } from '#lib/core/modules.ts';
	import PageHeader from './PageHeader.svelte';
	let { module, features }: { module: PosModule; features: string[] } = $props();
</script>

<PageHeader title={module.name} subtitle={module.description} />

<div class="card p-8">
	<span class="badge bg-amber-100 text-amber-800">Planned for phase {module.phase}</span>
	<h2 class="mt-4 text-lg font-semibold">This screen is next on the build list</h2>
	<p class="mt-1 max-w-xl text-sm text-muted">
		The {module.name.toLowerCase()} module is switched on and its permissions and product fields are already active.
		These features will be built here:
	</p>
	<ul class="mt-5 grid gap-2 text-sm sm:grid-cols-2">
		{#each features as f}
			<li class="flex items-center gap-2"><span class="size-1.5 rounded-full bg-brand-500"></span>{f}</li>
		{/each}
	</ul>
</div>
