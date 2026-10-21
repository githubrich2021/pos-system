<script lang="ts">
	import { enhance } from '$app/forms';
	import { KeyRound } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Sign in</title></svelte:head>

<h2 class="text-2xl font-semibold">Sign in</h2>
<p class="mt-1 text-sm text-muted">Owners and managers sign in with email.</p>

<form
	method="POST"
	class="mt-8 space-y-4"
	use:enhance={() => {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	}}
>
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	<div>
		<label class="label" for="email">Email</label>
		<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
	</div>
	<div>
		<label class="label" for="password">Password</label>
		<input class="input" id="password" name="password" type="password" autocomplete="current-password" required />
	</div>
	<button class="btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
</form>

{#if data.hasDevice}
	<a href="/pin" class="btn-secondary mt-3 w-full"><KeyRound size={16} /> Staff PIN login</a>
{/if}

<p class="mt-8 text-center text-sm text-muted">
	New business? <a href="/register" class="font-medium text-brand-700 hover:underline">Start a free trial</a>
</p>
