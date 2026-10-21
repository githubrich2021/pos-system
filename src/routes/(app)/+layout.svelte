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
			class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(item.href)
				? 'bg-white/10 text-white'
				: 'text-white/65 hover:bg-white/5 hover:text-white'}"
			aria-current={isActive(item.href) ? 'page' : undefined}
		>
			<item.icon size={18} />
			{item.label}
		</a>
	{/each}
{/snippet}

<div class="min-h-screen lg:pl-64 print:pl-0">
	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-40 flex w-64 print:hidden flex-col bg-ink px-3 py-5 transition-transform lg:translate-x-0 {open
			? 'translate-x-0'
			: '-translate-x-full'}"
	>
		<div class="flex items-center justify-between px-3">
			<div class="flex items-center gap-2.5 font-semibold text-white">
				<span class="grid size-8 place-items-center rounded-lg bg-brand-500"><ShoppingCart size={16} /></span>
				{PUBLIC_APP_NAME}
			</div>
			<button class="text-white/70 lg:hidden" onclick={() => (open = false)} aria-label="Close menu"><X size={20} /></button>
		</div>
		<p class="mt-5 truncate px-3 text-xs font-medium tracking-wide text-white/45 uppercase">{data.user.tenantName}</p>

		<nav class="mt-2 flex flex-1 flex-col gap-1">{@render links(nav.main)}</nav>
		<nav class="flex flex-col gap-1">{@render links(nav.bottom)}</nav>

		<div class="mt-4 border-t border-white/10 px-3 pt-4">
			<p class="truncate text-sm font-medium text-white">{data.user.name}</p>
			<p class="text-xs text-white/55">{data.user.roleName}</p>
			{#if data.device}
				<p class="mt-2 flex items-center gap-1.5 text-xs text-white/55"><Monitor size={12} /> {data.device.name}</p>
			{/if}
			<div class="mt-3 flex gap-2">
				{#if data.device}
					<form method="POST" action="/logout?/lock" class="flex-1">
						<button class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2 py-2 text-xs font-medium text-white hover:bg-white/15">
							<Lock size={14} /> Lock till
						</button>
					</form>
				{/if}
				<form method="POST" action="/logout?/signout" class="flex-1">
					<button class="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white">
						<LogOut size={14} /> Sign out
					</button>
				</form>
			</div>
		</div>
	</aside>

	{#if open}
		<button class="fixed inset-0 z-30 bg-ink/40 lg:hidden" aria-label="Close menu" onclick={() => (open = false)}></button>
	{/if}

	<!-- Mobile top bar -->
	<header class="sticky top-0 z-20 flex print:hidden items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
		<button onclick={() => (open = true)} aria-label="Open menu"><Menu size={22} /></button>
		<span class="font-semibold">{data.user.tenantName}</span>
	</header>

	<main class={wide ? 'px-4 py-4 sm:px-6 lg:py-6' : 'mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10'}>
		{@render children()}
	</main>
</div>
