<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { ClipboardList } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let starting = $state(false);

	const when = (d: Date | string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	const STATUS: Record<string, { label: string; class: string }> = {
		counting: { label: 'Counting', class: 'bg-amber-100 text-amber-800' },
		completed: { label: 'Completed', class: 'bg-brand-50 text-brand-700' },
		cancelled: { label: 'Cancelled', class: 'bg-canvas text-muted' }
	};
</script>

<svelte:head><title>Stock takes</title></svelte:head>

<div class="max-w-5xl space-y-5">
	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}

	{#if data.inProgress}
		<div class="card flex flex-wrap items-center justify-between gap-4 border border-amber-200 p-5">
			<div>
				<p class="font-semibold">A stock take is in progress</p>
				<p class="text-sm text-muted">{data.inProgress.counted} of {data.inProgress.items} products counted · started {when(data.inProgress.startedAt)}</p>
			</div>
			<a href="/stock/takes/{data.inProgress.id}" class="btn-primary">Continue counting</a>
		</div>
	{:else}
		<form
			method="POST"
			action="?/start"
			class="card space-y-4 p-6"
			use:enhance={() => {
				starting = true;
				return async ({ update }) => {
					await update();
					starting = false;
				};
			}}
		>
			<div>
				<h2 class="font-semibold">Start a stock take</h2>
				<p class="text-sm text-muted">
					Count what is on the shelves and enter the numbers. When you complete it, stock is corrected to your count and the
					differences are recorded. Products you don't count are left as they are.
				</p>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label class="label" for="categoryId">What to count</label>
					<select class="input" id="categoryId" name="categoryId">
						<option value="">All products</option>
						{#each data.categories as c (c.id)}<option value={c.id}>Only {c.name}</option>{/each}
					</select>
				</div>
				<div>
					<label class="label" for="note">Note (optional)</label>
					<input class="input" id="note" name="note" maxlength="300" placeholder="e.g. End of month count" />
				</div>
			</div>
			<button class="btn-primary" disabled={starting}>{starting ? 'Starting…' : 'Start counting'}</button>
		</form>
	{/if}

	{#if data.takes.length === 0}
		<div class="card flex flex-col items-center p-12 text-center">
			<ClipboardList size={32} class="text-muted" />
			<p class="mt-3 font-medium">No stock takes yet</p>
		</div>
	{:else}
		<div class="card overflow-x-auto">
			<table class="table-base">
				<thead><tr><th>Started</th><th>By</th><th>Note</th><th class="text-right">Counted</th><th>Status</th></tr></thead>
				<tbody>
					{#each data.takes as t (t.id)}
						<tr class="cursor-pointer hover:bg-canvas" onclick={() => goto(`/stock/takes/${t.id}`)}>
							<td class="whitespace-nowrap tabular-nums"><a href="/stock/takes/{t.id}" class="hover:underline">{when(t.startedAt)}</a></td>
							<td>{t.startedBy ?? '—'}</td>
							<td class="text-muted">{t.note ?? '—'}</td>
							<td class="text-right tabular-nums">{t.status === 'counting' ? `${t.counted} / ${t.items}` : t.counted}</td>
							<td><span class="badge {STATUS[t.status].class}">{STATUS[t.status].label}</span></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
