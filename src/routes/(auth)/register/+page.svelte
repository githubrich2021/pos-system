<script lang="ts">
	import { enhance } from '$app/forms';
	import { MODULES } from '#lib/modules/index.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let loading = $state(false);
	const chosen = $derived(form?.modules ?? ['retail']);
</script>

<svelte:head><title>Start a free trial</title></svelte:head>

<h2 class="text-2xl font-semibold">Set up your business</h2>
<p class="mt-1 text-sm text-muted">30-day free trial. You can change everything later.</p>

<form
	method="POST"
	class="mt-8 space-y-4"
	use:enhance={() => {
		loading = true;
		return async ({ update }) => {
			await update({ reset: false });
			loading = false;
		};
	}}
>
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	<div>
		<label class="label" for="businessName">Business name</label>
		<input class="input" id="businessName" name="businessName" required value={form?.businessName ?? ''} />
	</div>
	<div>
		<label class="label" for="ownerName">Your name</label>
		<input class="input" id="ownerName" name="ownerName" autocomplete="name" required value={form?.ownerName ?? ''} />
	</div>
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="label" for="email">Email</label>
			<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
		</div>
		<div>
			<label class="label" for="phone">Phone</label>
			<input class="input" id="phone" name="phone" type="tel" autocomplete="tel" value={form?.phone ?? ''} />
		</div>
	</div>
	<div>
		<label class="label" for="password">Password</label>
		<input class="input" id="password" name="password" type="password" minlength="8" autocomplete="new-password" required />
	</div>
	<fieldset>
		<legend class="label">What kind of business?</legend>
		<div class="grid grid-cols-2 gap-2">
			{#each MODULES as m (m.key)}
				<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm has-checked:border-brand-500 has-checked:bg-brand-50">
					<input type="checkbox" name="modules" value={m.key} checked={chosen.includes(m.key)} class="accent-brand-600" />
					<m.icon size={16} class="text-muted" />
					{m.name}
				</label>
			{/each}
		</div>
	</fieldset>
	<button class="btn-primary w-full" disabled={loading}>{loading ? 'Setting up…' : 'Create my business'}</button>
</form>

<p class="mt-8 text-center text-sm text-muted">
	Already have an account? <a href="/login" class="font-medium text-brand-700 hover:underline">Sign in</a>
</p>
