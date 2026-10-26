<script lang="ts">
	import { page } from '$app/state';
	import { CircleCheck, Circle, ArrowRight, Wallet, ReceiptText, Package, TriangleAlert } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const welcome = $derived(page.url.searchParams.has('welcome'));
	const setupLeft = $derived(data.setup.filter((s) => !s.done).length);
	const firstName = $derived(data.user.name.split(' ')[0]);
</script>

<svelte:head><title>Dashboard</title></svelte:head>

<PageHeader title={welcome ? `Welcome, ${firstName}` : `Hello, ${firstName}`} subtitle={data.user.tenantName} />

<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard highlight label="Sales today" icon={Wallet} value={formatMoney(data.stats.salesToday, data.user.currency)} />
	<StatCard label="Receipts today" icon={ReceiptText} value={data.stats.salesCountToday} />
	<StatCard label="Active products" icon={Package} value={data.stats.products} />
	<StatCard label="Low on stock" icon={TriangleAlert} value={data.stats.lowStock} warn={data.stats.lowStock > 0} />
</div>

{#if setupLeft > 0}
	<section class="card mt-5 p-6">
		<h2 class="font-semibold">Get your business ready</h2>
		<p class="mt-1 text-sm text-muted">{setupLeft} of {data.setup.length} steps left</p>
		<ul class="mt-4 divide-y divide-line">
			{#each data.setup as step}
				<li>
					<a href={step.href} class="group flex items-center gap-3 py-3 text-sm">
						{#if step.done}
							<CircleCheck size={20} class="text-brand-600" />
							<span class="text-muted line-through">{step.label}</span>
						{:else}
							<Circle size={20} class="text-line" />
							<span class="font-medium">{step.label}</span>
							<ArrowRight size={16} class="ml-auto text-muted transition group-hover:translate-x-0.5" />
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
