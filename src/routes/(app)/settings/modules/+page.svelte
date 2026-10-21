<script lang="ts">
	import { enhance } from '$app/forms';
	import { MODULES } from '#lib/modules/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Modules</title></svelte:head>

<p class="mb-5 max-w-2xl text-sm text-muted">
	Switch on the features your business needs. Turning a module off hides its screens but keeps all its data.
</p>
{#if form?.message}<p class="alert-error mb-4 max-w-2xl">{form.message}</p>{/if}

<div class="grid gap-4 md:grid-cols-2">
	{#each MODULES as m (m.key)}
		{@const on = data.user.modules.includes(m.key)}
		<div class="card flex flex-col p-5 {on ? 'border-brand-500' : ''}">
			<div class="flex items-start gap-3">
				<span class="grid size-10 shrink-0 place-items-center rounded-lg {on ? 'bg-brand-100 text-brand-700' : 'bg-canvas text-muted'}">
					<m.icon size={20} />
				</span>
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h3 class="font-semibold">{m.name}</h3>
						{#if m.status === 'preview'}<span class="badge bg-amber-100 text-amber-800">In development</span>{/if}
					</div>
					<p class="mt-1 text-sm text-muted">{m.description}</p>
				</div>
			</div>
			<form method="POST" action="?/toggle" use:enhance class="mt-4 flex justify-end">
				<input type="hidden" name="key" value={m.key} />
				<input type="hidden" name="enable" value={on ? 'false' : 'true'} />
				<button class={on ? 'btn-secondary' : 'btn-primary'}>{on ? 'Switch off' : 'Switch on'}</button>
			</form>
		</div>
	{/each}
</div>
