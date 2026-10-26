<script lang="ts">
	import { page } from '$app/state';
	import { PackageMinus, PackagePlus } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = [
		{ label: 'Overview', href: '/stock' },
		{ label: 'Movements', href: '/stock/movements' },
		{ label: 'Deliveries', href: '/stock/purchases' },
		{ label: 'Stock takes', href: '/stock/takes' },
		{ label: 'Suppliers', href: '/stock/suppliers' }
	];
	const isActive = (href: string) =>
		href === '/stock' ? page.url.pathname === href : page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<PageHeader title="Stock" subtitle="Stock levels, deliveries and counts for this branch.">
	{#snippet actions()}
		<a href="/stock/adjust" class="btn-secondary"><PackageMinus size={16} /> Adjust stock</a>
		<a href="/stock/purchases/new" class="btn-primary"><PackagePlus size={16} /> Receive stock</a>
	{/snippet}
</PageHeader>

<nav class="mb-6 flex gap-1 overflow-x-auto border-b border-line">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class="-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap {isActive(tab.href)
				? 'border-brand-600 text-brand-700'
				: 'border-transparent text-muted hover:text-ink'}"
			aria-current={isActive(tab.href) ? 'page' : undefined}>{tab.label}</a
		>
	{/each}
</nav>

{@render children()}
