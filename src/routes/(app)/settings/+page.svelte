<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = $derived(data.tenant);
</script>

<svelte:head><title>Business settings</title></svelte:head>

<form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })} class="card max-w-2xl space-y-4 p-6">
	<h2 class="font-semibold">Business details</h2>
	<p class="-mt-2 text-sm text-muted">Shown on receipts.</p>
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	{#if form?.saved}<p class="alert-success">Saved.</p>{/if}
	<div>
		<label class="label" for="name">Business name</label>
		<input class="input" id="name" name="name" required value={t.name} />
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="label" for="phone">Phone</label>
			<input class="input" id="phone" name="phone" value={t.phone ?? ''} />
		</div>
		<div>
			<label class="label" for="email">Email</label>
			<input class="input" id="email" name="email" type="email" value={t.email ?? ''} />
		</div>
	</div>
	<div>
		<label class="label" for="address">Address</label>
		<input class="input" id="address" name="address" value={t.address ?? ''} />
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="label" for="taxId">Tax ID (TIN)</label>
			<input class="input" id="taxId" name="taxId" value={t.taxId ?? ''} />
		</div>
		<div>
			<span class="label">Currency</span>
			<p class="input bg-canvas text-muted">{t.currency}</p>
		</div>
	</div>
	<button class="btn-primary">Save changes</button>
</form>
