<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { Lock, LogOut, Menu, Monitor, ShoppingCart, X } from '@lucide/svelte';
	import { buildNav } from '#lib/nav.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let open = $state(false);

	const nav = $derived(buildNav(data.user.modules, data.user.permissions));
	// The till screen uses the full width and height of the window
	const wide = $derived(page.url.pathname === '/sell');
	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

{#snippet links(items: typeof nav.main)}
	{#each items as item (item.href)}
		<a
			href={item.href}
			onclick={() => (open = false)}
			class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors {isActive(item.href)
				? 'bg-lime text-forest'
				: 'text-white/75 hover:bg-white/8 hover:text-white'}"
			aria-current={isActive(item.href) ? 'page' : undefined}
		>
			<item.icon size={18} />
			{item.label}
		</a>
	{/each}
{/snippet}

<div class="min-h-screen lg:pl-[17.5rem] print:pl-0">
	<!-- Sidebar: a floating rounded panel on large screens, a drawer on phones -->
	<aside
		class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest px-4 py-6 transition-transform lg:inset-y-3 lg:left-3 lg:translate-x-0 lg:rounded-3xl print:hidden {open
			? 'translate-x-0'
			: '-translate-x-full'}"
	>
		<div class="flex items-center justify-between px-2">
			<div class="flex items-center gap-2.5 text-lg font-semibold text-white">
				<span class="grid size-8 place-items-center rounded-lg bg-lime text-forest"><ShoppingCart size={16} /></span>
				{PUBLIC_APP_NAME}
			</div>
			<button class="text-white/70 lg:hidden" onclick={() => (open = false)} aria-label="Close menu"><X size={20} /></button>
		</div>
		<p class="mt-6 truncate px-3.5 text-xs font-medium tracking-wide text-white/45 uppercase">{data.user.tenantName}</p>

		<nav class="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto">{@render links(nav.main)}</nav>
		<nav class="mt-4 flex flex-col gap-1">{@render links(nav.bottom)}</nav>

		<!-- Who's signed in -->
		<div class="mt-4 rounded-2xl bg-forest-light p-4">
			<div class="flex items-center gap-3">
				<span class="grid size-9 shrink-0 place-items-center rounded-full bg-lime text-sm font-semibold text-forest">
					{data.user.name.charAt(0).toUpperCase()}
				</span>
				<div class="min-w-0">
					<p class="truncate text-sm font-medium text-white">{data.user.name}</p>
					<p class="truncate text-xs text-white/60">{data.user.roleName}</p>
				</div>
			</div>
			{#if data.device}
				<p class="mt-3 flex items-center gap-1.5 text-xs text-white/60"><Monitor size={12} /> {data.device.name}</p>
				<form method="POST" action="/logout?/lock" class="mt-3">
					<button class="flex w-full items-center justify-center gap-1.5 rounded-full bg-lime px-3 py-2 text-xs font-semibold text-forest hover:bg-lime-dark">
						<Lock size={14} /> Lock till
					</button>
				</form>
			{/if}
		</div>

		<form method="POST" action="/logout?/signout" class="mt-3">
			<button class="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/75 hover:bg-white/8 hover:text-white">
				<LogOut size={18} /> Sign out
			</button>
		</form>
	</aside>

	{#if open}
		<button class="fixed inset-0 z-30 bg-ink/40 lg:hidden" aria-label="Close menu" onclick={() => (open = false)}></button>
	{/if}

	<!-- Mobile top bar -->
	<header class="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden print:hidden">
		<button onclick={() => (open = true)} aria-label="Open menu"><Menu size={22} /></button>
		<span class="font-semibold">{data.user.tenantName}</span>
	</header>

	<main class={wide ? 'px-4 py-4 sm:px-6 lg:py-6' : 'mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:py-3 lg:pr-3 lg:pl-0'}>
		{@render children()}
	</main>
</div>
