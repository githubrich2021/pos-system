<script lang="ts">
	import { page } from '$app/state';
	import { can } from '#lib/core/permissions.ts';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const tabs = $derived(
		[
			{ label: 'Business', href: '/settings', permission: 'settings.manage' },
			{ label: 'Modules', href: '/settings/modules', permission: 'settings.manage' },
			{ label: 'Staff', href: '/settings/staff', permission: 'staff.manage' },
			{ label: 'This device', href: '/settings/device', permission: 'devices.manage' }
		].filter((t) => can(data.user.permissions, t.permission))
	);
</script>

<PageHeader title="Settings" />

<nav class="mb-6 flex gap-1 overflow-x-auto border-b border-line">
	{#each tabs as tab (tab.href)}
		{@const active = page.url.pathname === tab.href}
		<a
			href={tab.href}
			class="-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap {active
				? 'border-brand-600 text-brand-700'
				: 'border-transparent text-muted hover:text-ink'}">{tab.label}</a
		>
	{/each}
</nav>

{@render children()}
