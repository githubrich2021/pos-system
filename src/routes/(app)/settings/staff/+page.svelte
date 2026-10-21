<script lang="ts">
	import { enhance } from '$app/forms';
	import { UserPlus, KeyRound } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let editingPin = $state<string | null>(null);
	const defaultRole = $derived(data.roles.find((r) => r.name === 'Cashier')?.id ?? data.roles[0]?.id);
	const c = $derived<Record<string, string>>(form && 'create' in form ? (form.create as Record<string, string>) : {});
</script>

<svelte:head><title>Staff</title></svelte:head>

{#if form?.message && !('create' in form) && !('pinFor' in form)}<p class="alert-error mb-4">{form.message}</p>{/if}
{#if form && 'created' in form}<p class="alert-success mb-4">{form.created} was added.</p>{/if}

<div class="grid gap-6 lg:grid-cols-[1fr_340px]">
	<div class="card h-fit overflow-x-auto">
		<table class="table-base">
			<thead><tr><th>Name</th><th>Role</th><th>Sign-in</th><th></th></tr></thead>
			<tbody>
				{#each data.staff as s (s.id)}
					<tr class={s.isActive ? '' : 'opacity-50'}>
						<td>
							<p class="font-medium">{s.name} {#if s.isSelf}<span class="text-xs text-muted">(you)</span>{/if}</p>
							{#if s.email}<p class="text-xs text-muted">{s.email}</p>{/if}
						</td>
						<td>{s.role}</td>
						<td class="text-xs">
							{#if s.email}<span class="badge bg-canvas text-muted">Email</span>{/if}
							{#if s.hasPin}<span class="badge bg-brand-50 text-brand-700">PIN</span>{/if}
							{#if !s.isActive}<span class="badge bg-red-50 text-red-700">Inactive</span>{/if}
						</td>
						<td class="text-right whitespace-nowrap">
							{#if editingPin === s.id}
								<form
									method="POST"
									action="?/setPin"
									class="inline-flex gap-2"
									use:enhance={() => async ({ result, update }) => {
										await update();
										if (result.type === 'success') editingPin = null;
									}}
								>
									<input type="hidden" name="userId" value={s.id} />
									<input class="input w-24 py-1.5" name="pin" inputmode="numeric" pattern={'\\d{4,6}'} maxlength="6" placeholder="New PIN" required />
									<button class="btn-primary px-3 py-1.5">Save</button>
								</form>
								{#if form && 'pinFor' in form && form.pinFor === s.id}<p class="mt-1 text-xs text-red-700">{form.message}</p>{/if}
							{:else}
								<button class="btn-secondary px-3 py-1.5" onclick={() => (editingPin = s.id)}><KeyRound size={14} /> {s.hasPin ? 'Change PIN' : 'Set PIN'}</button>
								{#if !s.isSelf}
									<form method="POST" action="?/toggleActive" use:enhance class="inline">
										<input type="hidden" name="userId" value={s.id} />
										<button class="px-2 py-1.5 text-xs text-muted hover:text-ink">{s.isActive ? 'Deactivate' : 'Activate'}</button>
									</form>
								{/if}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<form method="POST" action="?/create" use:enhance class="card h-fit space-y-4 p-6">
		<h2 class="flex items-center gap-2 font-semibold"><UserPlus size={18} /> Add staff</h2>
		{#if form?.message && 'create' in form}<p class="alert-error">{form.message}</p>{/if}
		<div>
			<label class="label" for="name">Name</label>
			<input class="input" id="name" name="name" required value={c.name ?? ''} />
		</div>
		<div>
			<label class="label" for="roleId">Role</label>
			<select class="input" id="roleId" name="roleId">
				{#each data.roles as r (r.id)}<option value={r.id} selected={(c.roleId || defaultRole) === r.id}>{r.name}</option>{/each}
			</select>
		</div>
		<div>
			<label class="label" for="pin">Till PIN <span class="font-normal text-muted">· 4–6 digits</span></label>
			<input class="input" id="pin" name="pin" inputmode="numeric" pattern={'\\d{4,6}'} maxlength="6" />
		</div>
		<details class="text-sm">
			<summary class="cursor-pointer text-muted">Also allow email sign-in</summary>
			<div class="mt-3 space-y-3">
				<input class="input" name="email" type="email" placeholder="Email" value={c.email ?? ''} />
				<input class="input" name="password" type="password" placeholder="Password (8+ characters)" minlength="8" />
			</div>
		</details>
		<button class="btn-primary w-full">Add staff member</button>
	</form>
</div>
