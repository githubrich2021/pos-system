<script lang="ts">
	import { enhance } from '$app/forms';
	import { MODULES } from '#lib/modules/index.ts';
	import { Building2, User, Mail, Phone, Lock } from '@lucide/svelte';
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
	class="mt-7 space-y-3.5"
	use:enhance={() => {
		loading = true;
		return async ({ update }) => {
			await update({ reset: false });
			loading = false;
		};
	}}
>
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	<div class="field">
		<label class="sr-only" for="businessName">Business name</label>
		<Building2 size={18} />
		<input class="input" id="businessName" name="businessName" placeholder="Business name" required value={form?.businessName ?? ''} />
	</div>
	<div class="field">
		<label class="sr-only" for="ownerName">Your name</label>
		<User size={18} />
		<input class="input" id="ownerName" name="ownerName" placeholder="Your name" autocomplete="name" required value={form?.ownerName ?? ''} />
	</div>
	<div class="grid gap-3.5 sm:grid-cols-2">
		<div class="field">
			<label class="sr-only" for="email">Email</label>
			<Mail size={18} />
			<input class="input" id="email" name="email" type="email" placeholder="Email" autocomplete="email" required value={form?.email ?? ''} />
		</div>
		<div class="field">
			<label class="sr-only" for="phone">Phone</label>
			<Phone size={18} />
			<input class="input" id="phone" name="phone" type="tel" placeholder="Phone (optional)" autocomplete="tel" value={form?.phone ?? ''} />
		</div>
	</div>
	<div class="field">
		<label class="sr-only" for="password">Password</label>
		<Lock size={18} />
		<input class="input" id="password" name="password" type="password" placeholder="Password (8+ characters)" minlength="8" autocomplete="new-password" required />
	</div>
	<fieldset class="pt-2">
		<legend class="label">What kind of business?</legend>
		<div class="grid grid-cols-2 gap-2">
			{#each MODULES as m (m.key)}
				<label class="flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white transition has-checked:border-lime has-checked:bg-lime has-checked:text-forest">
					<input type="checkbox" name="modules" value={m.key} checked={chosen.includes(m.key)} class="accent-forest" />
					<m.icon size={16} />
					{m.name}
				</label>
			{/each}
		</div>
	</fieldset>
	<div class="border-t border-white/20 pt-5">
		<button class="btn-primary h-12 w-full text-base font-semibold tracking-wide" disabled={loading}>{loading ? 'Setting up…' : 'Create my business'}</button>
	</div>
</form>

<p class="mt-6 text-center text-sm text-muted">
	Already have an account? <a href="/login" class="link hover:underline">Sign in</a>
</p>
