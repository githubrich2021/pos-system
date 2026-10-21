<script lang="ts">
	import { enhance } from '$app/forms';
	import { Monitor } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const current = $derived(data.devices.find((d) => d.id === data.current));
</script>

<svelte:head><title>This device</title></svelte:head>

{#if form?.message}<p class="alert-error mb-4">{form.message}</p>{/if}

<div class="grid gap-6 lg:grid-cols-2">
	<section class="card p-6">
		<h2 class="flex items-center gap-2 font-semibold"><Monitor size={18} /> This computer</h2>
		{#if current}
			<p class="mt-3 text-sm">
				This browser is registered as <strong>{current.name}</strong> ({current.code}) at {current.branch}.
			</p>
			<p class="mt-2 text-sm text-muted">Staff can sign in here with their PIN. Use “Lock till” in the sidebar between cashiers.</p>
		{:else}
			<p class="mt-3 text-sm text-muted">
				Register this browser as a till so cashiers can sign in quickly with a PIN instead of an email and password.
			</p>
			<form method="POST" action="?/register" use:enhance class="mt-4 flex gap-2">
				<input class="input" name="name" placeholder="e.g. Front counter" required />
				<button class="btn-primary whitespace-nowrap">Set up as till</button>
			</form>
		{/if}
	</section>

	<section class="card overflow-x-auto">
		<h2 class="px-6 pt-6 font-semibold">All tills</h2>
		{#if data.devices.length === 0}
			<p class="px-6 pt-2 pb-6 text-sm text-muted">No tills yet.</p>
		{:else}
			<table class="table-base mt-2">
				<tbody>
					{#each data.devices as d (d.id)}
						<tr>
							<td><span class="font-mono text-xs text-muted">{d.code}</span> <span class="font-medium">{d.name}</span>
								{#if d.id === data.current}<span class="badge ml-1 bg-brand-50 text-brand-700">This one</span>{/if}</td>
							<td class="text-muted">{d.branch}</td>
							<td class="text-right">
								<form method="POST" action="?/revoke" use:enhance>
									<input type="hidden" name="deviceId" value={d.id} />
									<button class="text-xs text-red-700 hover:underline">Remove</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>
