<script lang="ts">
	import { page } from '$app/state';
	import { CircleCheck, Circle, ArrowRight } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatMoney } from '#lib/core/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const welcome = $derived(page.url.searchParams.has('welcome'));
	const setupLeft = $derived(data.setup.filter((s) => !s.done).length);
	const firstName = $derived(data.user.name.split(' ')[0]);
</script>

<svelte:head><title>Dashboard</title></svelte:head>

<PageHeader title={welcome ? `Welcome, ${firstName}` : `Hello, ${firstName}`} subtitle={data.user.tenantName} />

<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
	<div class="card p-5">
		<p class="text-sm text-muted">Sales today</p>
		<p class="mt-2 text-xl font-semibold sm:text-2xl">{formatMoney(data.stats.salesToday, data.user.currency)}</p>
	</div>
	<div class="card p-5">
		<p class="text-sm text-muted">Receipts today</p>
		<p class="mt-2 text-2xl font-semibold">{data.stats.salesCountToday}</p>
	</div>
	<div class="card p-5">
		<p class="text-sm text-muted">Active products</p>
		<p class="mt-2 text-2xl font-semibold">{data.stats.products}</p>
	</div>
	<div class="card p-5">
		<p class="text-sm text-muted">Low on stock</p>
		<p class="mt-2 text-2xl font-semibold {data.stats.lowStock > 0 ? 'text-amber-600' : ''}">{data.stats.lowStock}</p>
	</div>
</div>

{#if setupLeft > 0}
	<section class="card mt-6 p-6">
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
