<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { ArrowLeft } from '@lucide/svelte';
	import ProductPicker from '#lib/components/stock/ProductPicker.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import { roundQty } from '#lib/core/pricing.ts';
	import { formatQty } from '#lib/core/stock.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const take = $derived(data.take.take);
	const counting = $derived(take.status === 'counting');
	const money = (n: number) => formatMoney(n, data.user.currency);
	const when = (d: Date | string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

	/** What has been typed, by product. '' = not counted. */
	let counts = $state<Record<string, string>>({});
	/** Counts as last saved on the server, to know what's unsaved. */
	let savedCounts = $state<Record<string, string>>({});
	$effect.pre(() => {
		const fromServer = Object.fromEntries(data.take.items.map((i) => [i.productId, i.countedQty === null ? '' : String(i.countedQty)]));
		counts = { ...fromServer };
		savedCounts = fromServer;
	});

	let filter = $state<'all' | 'todo' | 'diff'>('all');
	let busy = $state<'' | 'save' | 'complete' | 'cancel'>('');
	let confirmComplete = $state(false);

	const rows = $derived(
		data.take.items.map((i) => {
			const raw = counts[i.productId] ?? '';
			const counted = raw.trim() === '' ? null : Number(raw);
			const diff = counted === null || !Number.isFinite(counted) ? null : roundQty(counted - i.systemQty);
			return { ...i, raw, counted, diff, value: diff === null ? 0 : Math.round(diff * i.cost) };
		})
	);
	const visible = $derived(
		rows.filter((r) => (filter === 'todo' ? r.counted === null : filter === 'diff' ? r.diff !== null && r.diff !== 0 : true))
	);
	const counted = $derived(rows.filter((r) => r.counted !== null).length);
	const differences = $derived(rows.filter((r) => r.diff !== null && r.diff !== 0));
	const valueChange = $derived(differences.reduce((sum, r) => sum + r.value, 0));
	const dirty = $derived(data.take.items.some((i) => (counts[i.productId] ?? '') !== (savedCounts[i.productId] ?? '')));
	const payload = $derived(JSON.stringify(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v.trim() === '' ? null : Number(v)]))));

	beforeNavigate(({ cancel, type }) => {
		if (counting && dirty && type !== 'form' && !confirm('You have counts that are not saved. Leave anyway?')) cancel();
	});

	function focusProduct(productId: string) {
		filter = 'all';
		requestAnimationFrame(() => {
			const el = document.getElementById(`count-${productId}`) as HTMLInputElement | null;
			el?.scrollIntoView({ block: 'center' });
			el?.focus();
			el?.select();
		});
	}

	/** Enter in a count box moves to the next product, like a spreadsheet. */
	function nextOnEnter(e: KeyboardEvent, index: number) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const next = visible[index + 1];
		if (next) focusProduct(next.productId);
	}

	const submit =
		(kind: 'save' | 'complete' | 'cancel'): SubmitFunction =>
		({ cancel }) => {
			if (kind === 'cancel' && !confirm('Cancel this stock take? Counts entered so far will be discarded.')) return cancel();
			busy = kind;
			return async ({ update }) => {
				await update({ reset: false });
				busy = '';
				confirmComplete = false;
			};
		};
</script>

<svelte:head><title>Stock take</title></svelte:head>

<div class="max-w-6xl space-y-5">
	<a href="/stock/takes" class="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={16} /> All stock takes</a>

	{#if form?.message}<p class="alert-error">{form.message}</p>{/if}
	{#if form?.saved && !dirty}<p class="alert-success">Counts saved.</p>{/if}
	{#if form?.completed}
		<p class="alert-success">
			Stock take completed. {form.completed.counted} products counted, {form.completed.adjusted} corrected
			({form.completed.valueChange >= 0 ? '+' : ''}{money(form.completed.valueChange)} at cost).
		</p>
	{/if}

	<section class="card flex flex-wrap items-center justify-between gap-4 p-5">
		<div>
			<h2 class="text-lg font-semibold">
				Stock take
				{#if take.status === 'completed'}<span class="badge ml-1 bg-brand-50 text-brand-700">Completed</span>
				{:else if take.status === 'cancelled'}<span class="badge ml-1 bg-canvas text-muted">Cancelled</span>
				{:else}<span class="badge ml-1 bg-amber-100 text-amber-800">Counting</span>{/if}
			</h2>
			<p class="text-sm text-muted">
				Started {when(take.startedAt)} by {data.take.startedBy ?? '—'}
				{#if take.completedAt} · {take.status === 'completed' ? 'completed' : 'cancelled'} {when(take.completedAt)}{/if}
				{#if take.note} · {take.note}{/if}
			</p>
		</div>
		<div class="flex gap-6 text-sm">
			<div><p class="text-muted">Counted</p><p class="text-lg font-semibold tabular-nums">{counted} / {rows.length}</p></div>
			<div><p class="text-muted">Differences</p><p class="text-lg font-semibold tabular-nums">{differences.length}</p></div>
			<div>
				<p class="text-muted">Value change (cost)</p>
				<p class="text-lg font-semibold tabular-nums {valueChange < 0 ? 'text-red-700' : valueChange > 0 ? 'text-brand-700' : ''}">
					{valueChange > 0 ? '+' : ''}{money(valueChange)}
				</p>
			</div>
		</div>
	</section>

	<div class="flex flex-wrap items-center gap-3">
		<div class="flex gap-1 rounded-full bg-white p-1">
			{#each [{ key: 'all', label: 'All' }, ...(counting ? [{ key: 'todo', label: 'Not counted' }] : []), { key: 'diff', label: 'Differences' }] as f (f.key)}
				<button
					type="button"
					class="rounded-full px-3.5 py-1.5 text-sm font-medium {filter === f.key ? 'bg-forest text-white' : 'text-muted hover:text-ink'}"
					onclick={() => (filter = f.key as typeof filter)}>{f.label}</button
				>
			{/each}
		</div>
		{#if counting}
			<div class="min-w-64 flex-1 sm:max-w-sm">
				<ProductPicker
					products={data.take.items.map((i) => ({ id: i.productId, name: i.name, sku: i.sku, barcode: i.barcode, unit: i.unit, stock: i.systemQty }))}
					placeholder="Find or scan a product to count"
					onpick={(p) => focusProduct(p.id)}
				/>
			</div>
		{/if}
	</div>

	<div class="card overflow-x-auto">
		<table class="table-base">
			<thead>
				<tr>
					<th>Product</th>
					<th>Category</th>
					<th class="text-right">{counting ? 'System says' : 'System had'}</th>
					<th class="w-36 text-right">Counted</th>
					<th class="text-right">Difference</th>
					<th class="text-right">Value</th>
				</tr>
			</thead>
			<tbody>
				{#each visible as r, i (r.productId)}
					<tr>
						<td>
							<p class="font-medium">{r.name}</p>
							{#if r.sku}<p class="font-mono text-xs text-muted">{r.sku}</p>{/if}
						</td>
						<td class="text-muted">{r.category ?? '—'}</td>
						<td class="text-right text-muted tabular-nums">{formatQty(r.systemQty)} {r.unit}</td>
						<td class="text-right">
							{#if counting}
								<input
									id="count-{r.productId}"
									class="input py-1.5 text-right tabular-nums"
									type="number"
									step="0.001"
									min="0"
									inputmode="decimal"
									placeholder="—"
									aria-label="Counted {r.name}"
									value={r.raw}
									oninput={(e) => (counts[r.productId] = e.currentTarget.value)}
									onkeydown={(e) => nextOnEnter(e, i)}
								/>
							{:else}
								<span class="tabular-nums">{r.counted === null ? '—' : `${formatQty(r.counted)} ${r.unit}`}</span>
							{/if}
						</td>
						<td class="text-right font-medium tabular-nums {r.diff && r.diff < 0 ? 'text-red-700' : r.diff && r.diff > 0 ? 'text-brand-700' : 'text-muted'}">
							{r.diff === null ? '' : r.diff === 0 ? '✓' : `${r.diff > 0 ? '+' : ''}${formatQty(r.diff)}`}
						</td>
						<td class="text-right tabular-nums {r.value < 0 ? 'text-red-700' : ''}">{r.diff ? money(r.value) : ''}</td>
					</tr>
				{:else}
					<tr><td colspan="6" class="py-8 text-center text-muted">Nothing to show.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if counting}
		<div class="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-forest p-4 text-white shadow-lg">
			<p class="text-sm text-white/80">
				{#if dirty}You have unsaved counts.{:else}All counts saved.{/if}
				System numbers are live, so sales during the count are taken into account.
			</p>
			<div class="flex flex-wrap gap-2">
				<form method="POST" action="?/cancel" use:enhance={submit('cancel')}>
					<button class="rounded-full px-4 py-2.5 text-sm font-medium text-white/75 hover:text-white" disabled={!!busy}>
						{busy === 'cancel' ? 'Cancelling…' : 'Cancel stock take'}
					</button>
				</form>
				<form method="POST" action="?/save" use:enhance={submit('save')}>
					<input type="hidden" name="counts" value={payload} />
					<button class="rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium hover:bg-white/10 disabled:opacity-50" disabled={!!busy || !dirty}>
						{busy === 'save' ? 'Saving…' : 'Save progress'}
					</button>
				</form>
				{#if confirmComplete}
					<form method="POST" action="?/complete" use:enhance={submit('complete')} class="flex items-center gap-2">
						<input type="hidden" name="counts" value={payload} />
						<span class="text-sm">Correct {differences.length} products?</span>
						<button class="btn-primary" disabled={!!busy}>{busy === 'complete' ? 'Completing…' : 'Yes, complete'}</button>
						<button type="button" class="text-sm text-white/75 hover:text-white" onclick={() => (confirmComplete = false)}>No</button>
					</form>
				{:else}
					<button type="button" class="btn-primary" disabled={!!busy || counted === 0} onclick={() => (confirmComplete = true)}>Complete stock take</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
