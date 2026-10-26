<script lang="ts" module>
	export interface TillCustomer {
		id: string;
		name: string;
		phone: string | null;
		creditLimit: number;
		/** What they owe now. */
		balance: number;
		/** Credit still available for "pay later". */
		available: number;
	}
</script>

<script lang="ts">
	import { UserRound, UserPlus, X, Search } from '@lucide/svelte';
	import { formatMoney } from '#lib/core/money.ts';

	let {
		customer = $bindable(),
		currency,
		canAdd
	}: { customer: TillCustomer | null; currency: string; canAdd: boolean } = $props();

	const money = (n: number) => formatMoney(n, currency);

	let open = $state(false);
	let query = $state('');
	let results = $state<TillCustomer[]>([]);
	let searching = $state(false);
	let adding = $state(false);
	let newName = $state('');
	let newPhone = $state('');
	let error = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let seq = 0;

	function search() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			return;
		}
		timer = setTimeout(async () => {
			const mine = ++seq;
			searching = true;
			try {
				const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
				if (mine === seq) results = res.ok ? await res.json() : [];
			} catch {
				if (mine === seq) error = "Can't reach the server.";
			} finally {
				if (mine === seq) searching = false;
			}
		}, 200);
	}

	function choose(c: TillCustomer) {
		customer = c;
		close();
	}

	function close() {
		open = false;
		adding = false;
		query = '';
		results = [];
		error = '';
	}

	function startAdding() {
		adding = true;
		error = '';
		// Typed digits are probably a phone number, letters a name
		if (/^[\d\s+]+$/.test(query.trim())) newPhone = query.trim();
		else newName = query.trim();
	}

	async function add(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		try {
			const res = await fetch('/api/customers', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: newName, phone: newPhone })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				error = body.message ?? 'Could not add the customer.';
				return;
			}
			newName = '';
			newPhone = '';
			choose(body);
		} catch {
			error = "Can't reach the server.";
		}
	}
</script>

{#if customer}
	<div class="flex items-center justify-between gap-2 border-b border-line bg-brand-50 px-4 py-2.5">
		<div class="flex min-w-0 items-center gap-2">
			<UserRound size={16} class="shrink-0 text-brand-700" />
			<div class="min-w-0">
				<p class="truncate text-sm font-medium">{customer.name}</p>
				<p class="text-xs text-muted">
					{#if customer.balance > 0}Owes {money(customer.balance)}{:else}Nothing owed{/if}
					{#if customer.creditLimit > 0} · {money(customer.available)} credit left{/if}
				</p>
			</div>
		</div>
		<button class="text-muted hover:text-ink" aria-label="Remove customer from sale" onclick={() => (customer = null)}><X size={16} /></button>
	</div>
{:else if !open}
	<button class="flex w-full items-center gap-2 border-b border-line px-4 py-2.5 text-sm text-muted hover:bg-canvas hover:text-ink" onclick={() => (open = true)}>
		<UserRound size={16} /> Add customer <span class="text-xs">(optional)</span>
	</button>
{:else}
	<div class="space-y-2 border-b border-line bg-canvas p-3">
		{#if adding}
			<form class="space-y-2" onsubmit={add}>
				<!-- svelte-ignore a11y_autofocus -->
				<input class="input py-2" placeholder="Customer name" bind:value={newName} required maxlength="120" autofocus aria-label="Customer name" />
				<input class="input py-2" placeholder="Phone number" bind:value={newPhone} type="tel" maxlength="20" aria-label="Phone number" />
				{#if error}<p class="text-xs text-red-700">{error}</p>{/if}
				<div class="flex gap-2">
					<button class="btn-primary flex-1 py-2">Add and use</button>
					<button type="button" class="btn-secondary py-2" onclick={() => (adding = false)}>Back</button>
				</div>
			</form>
		{:else}
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search size={14} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="input py-2 pl-8"
						placeholder="Name or phone"
						bind:value={query}
						oninput={search}
						onkeydown={(e) => {
							if (e.key === 'Escape') close();
							if (e.key === 'Enter' && results.length) (e.preventDefault(), choose(results[0]));
						}}
						autofocus
						aria-label="Find customer"
						autocomplete="off"
					/>
				</div>
				<button class="btn-secondary px-3 py-2" onclick={close} aria-label="Cancel"><X size={16} /></button>
			</div>
			{#if results.length}
				<ul class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
					{#each results as c (c.id)}
						<li>
							<button class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50" onclick={() => choose(c)}>
								<span class="min-w-0">
									<span class="block truncate font-medium">{c.name}</span>
									{#if c.phone}<span class="block text-xs text-muted">{c.phone}</span>{/if}
								</span>
								{#if c.balance > 0}<span class="shrink-0 text-xs text-amber-700">Owes {money(c.balance)}</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else if query.trim().length >= 2 && !searching}
				<p class="px-1 text-xs text-muted">No customer found.</p>
			{/if}
			{#if error}<p class="text-xs text-red-700">{error}</p>{/if}
			{#if canAdd}
				<button class="flex items-center gap-1.5 px-1 text-sm font-medium text-brand-700 hover:underline" onclick={startAdding}>
					<UserPlus size={14} /> New customer
				</button>
			{/if}
		{/if}
	</div>
{/if}
