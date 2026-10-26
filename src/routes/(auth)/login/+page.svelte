<script lang="ts">
	import { enhance } from '$app/forms';
	import { KeyRound, Mail, Lock } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Sign in</title></svelte:head>

<h2 class="text-2xl font-semibold">Welcome back</h2>
<p class="mt-1 text-sm text-muted">Owners and managers sign in with email.</p>

<form
	method="POST"
	class="mt-7 space-y-3.5"
	use:enhance={() => {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	}}
>
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	<div class="field">
		<label class="sr-only" for="email">Email</label>
		<Mail size={18} />
		<input class="input" id="email" name="email" type="email" placeholder="Email" autocomplete="email" required value={form?.email ?? ''} />
	</div>
	<div class="field">
		<label class="sr-only" for="password">Password</label>
		<Lock size={18} />
		<input class="input" id="password" name="password" type="password" placeholder="Password" autocomplete="current-password" required />
	</div>
	<div class="border-t border-white/20 pt-5">
		<button class="btn-primary h-12 w-full text-base font-semibold tracking-wide" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
	</div>
</form>

{#if data.hasDevice}
	<a href="/pin" class="btn-secondary mt-3 w-full"><KeyRound size={16} /> Staff PIN login</a>
{/if}

<p class="mt-6 text-center text-sm text-muted">
	New business? <a href="/register" class="link hover:underline">Start a free trial</a>
</p>
