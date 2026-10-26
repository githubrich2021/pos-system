<script lang="ts">
	import { enhance } from '$app/forms';
	import { Delete, Monitor } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let userId = $state<string | null>(null);
	let pin = $state('');
	let formEl = $state<HTMLFormElement>();

	const selected = $derived(data.staff.find((s) => s.id === userId));
	const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

	function press(key: string) {
		if (key === 'del') pin = pin.slice(0, -1);
		else if (pin.length < 6) pin += key;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!userId) return;
		if (/^\d$/.test(e.key)) press(e.key);
		else if (e.key === 'Backspace') press('del');
		else if (e.key === 'Enter' && pin.length >= 4) formEl?.requestSubmit();
		else if (e.key === 'Escape') ((userId = null), (pin = ''));
	}
</script>

<svelte:head><title>Staff login</title></svelte:head>
<svelte:window onkeydown={onKeydown} />

<p class="flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
	<Monitor size={14} /> {data.businessName} · {data.deviceName}
</p>

{#if !selected}
	<h2 class="mt-2 text-2xl font-semibold">Who's on the till?</h2>
	{#if data.staff.length === 0}
		<p class="alert-error mt-6">No staff have a PIN yet. A manager can add PINs under Settings → Staff.</p>
	{:else}
		<div class="mt-6 grid grid-cols-2 gap-3">
			{#each data.staff as person (person.id)}
				<button
					type="button"
					class="card flex flex-col items-start p-4 text-left transition hover:border-brand-500"
					onclick={() => ((userId = person.id), (pin = ''))}
				>
					<span class="grid size-10 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700">
						{person.name.slice(0, 1).toUpperCase()}
					</span>
					<span class="mt-3 font-medium">{person.name}</span>
					<span class="text-xs text-muted">{person.role}</span>
				</button>
			{/each}
		</div>
	{/if}
	<a href="/login" class="btn-secondary mt-8 w-full">Sign in with email instead</a>
{:else}
	<h2 class="mt-2 text-2xl font-semibold">Hi {selected.name}, enter your PIN</h2>

	<form
		method="POST"
		bind:this={formEl}
		use:enhance={() =>
			async ({ update }) => {
				pin = '';
				await update({ reset: false });
			}}
	>
		<input type="hidden" name="userId" value={userId} />
		<input type="hidden" name="pin" value={pin} />

		<div class="mt-6 flex justify-center gap-3" aria-label="PIN entered">
			{#each Array(6) as _, i}
				<span class="size-3.5 rounded-full {i < pin.length ? 'bg-lime' : 'bg-white/25'}"></span>
			{/each}
		</div>
		{#if form?.message && form.userId === userId}<p class="alert-error mt-4 text-center">{form.message}</p>{/if}

		<div class="mt-6 grid grid-cols-3 gap-3">
			{#each keys as key}
				{#if key === ''}
					<span></span>
				{:else}
					<button
						type="button"
						class="card h-16 text-xl font-medium transition active:bg-brand-50"
						aria-label={key === 'del' ? 'Delete' : key}
						onclick={() => press(key)}
					>
						{#if key === 'del'}<Delete class="mx-auto" size={22} />{:else}{key}{/if}
					</button>
				{/if}
			{/each}
		</div>

		<button class="btn-primary mt-6 h-12 w-full" disabled={pin.length < 4}>Unlock till</button>
		<button type="button" class="btn-secondary mt-3 w-full" onclick={() => ((userId = null), (pin = ''))}>
			Not {selected.name}?
		</button>
	</form>
{/if}
