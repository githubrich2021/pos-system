<script lang="ts">
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { ShoppingCart, UtensilsCrossed, Pill, Scissors } from '@lucide/svelte';
	let { children } = $props();
</script>

<div class="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
	<aside class="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
		<div class="flex items-center gap-2.5 text-lg font-semibold">
			<span class="grid size-9 place-items-center rounded-lg bg-brand-500"><ShoppingCart size={18} /></span>
			{PUBLIC_APP_NAME}
		</div>
		<div>
			<h1 class="max-w-md text-4xl leading-tight font-semibold">One till for every kind of business.</h1>
			<p class="mt-4 max-w-md text-white/70">
				Sell, track stock and see your numbers — even when the internet is down.
			</p>
			<ul class="mt-10 grid max-w-md grid-cols-2 gap-3 text-sm text-white/80">
				<li class="flex items-center gap-2"><ShoppingCart size={16} /> Retail shops</li>
				<li class="flex items-center gap-2"><UtensilsCrossed size={16} /> Restaurants & bars</li>
				<li class="flex items-center gap-2"><Pill size={16} /> Pharmacies</li>
				<li class="flex items-center gap-2"><Scissors size={16} /> Salons & services</li>
			</ul>
		</div>
		<p class="text-xs text-white/50">by MiddleCode Technologies</p>
	</aside>
	<main class="flex items-center justify-center p-6 sm:p-12">
		<div class="w-full max-w-sm">
			{@render children()}
		</div>
	</main>
</div>
