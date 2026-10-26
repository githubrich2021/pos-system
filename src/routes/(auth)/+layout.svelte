<script lang="ts">
	import { PUBLIC_APP_NAME } from '$app/env/public';
	import { ShoppingCart, UtensilsCrossed, Pill, Scissors, ReceiptText, Package, ChartColumn, Wallet } from '@lucide/svelte';
	let { children } = $props();

	// Floating hexagon icons around the illustration (position in %, delay in s)
	const floaters = [
		{ icon: ReceiptText, top: 14, left: 12, delay: 0 },
		{ icon: Package, top: 22, left: 58, delay: 1.2 },
		{ icon: Pill, top: 46, left: 6, delay: 0.6 },
		{ icon: ChartColumn, top: 40, left: 70, delay: 1.8 },
		{ icon: Wallet, top: 80, left: 64, delay: 0.9 },
		{ icon: UtensilsCrossed, top: 66, left: 2, delay: 2.4 }
	];
</script>

<div class="auth relative min-h-screen overflow-hidden bg-forest text-white">
	<!-- Background glows -->
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<div class="absolute -top-40 -left-40 size-[38rem] rounded-full bg-brand-500/40 blur-3xl"></div>
		<div class="absolute right-[-10rem] bottom-[-12rem] size-[34rem] rounded-full bg-lime/15 blur-3xl"></div>
		<div class="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:22px_22px]"></div>
	</div>

	<div class="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_minmax(0,30rem)] lg:py-12">
		<!-- Left: illustration -->
		<section class="relative hidden h-[34rem] lg:block" aria-hidden="true">
			<!-- Laptop showing a mini dashboard -->
			<div class="absolute top-1/2 left-1/2 w-[30rem] -translate-x-1/2 -translate-y-1/2">
				<div class="rounded-t-2xl border-[10px] border-b-0 border-ink/90 bg-canvas p-3 shadow-2xl">
					<div class="flex gap-2">
						<div class="w-16 space-y-1.5 rounded-lg bg-forest p-2">
							<div class="mb-3 h-2.5 w-8 rounded bg-lime"></div>
							<div class="h-2 rounded bg-lime/80"></div>
							{#each Array(5) as _}<div class="h-2 rounded bg-white/20"></div>{/each}
						</div>
						<div class="flex-1 space-y-2">
							<div class="h-6 rounded-md bg-white"></div>
							<div class="grid grid-cols-3 gap-2">
								<div class="h-14 rounded-md bg-forest p-2"><div class="h-2 w-6 rounded bg-lime"></div><div class="mt-2 h-3 w-12 rounded bg-white/80"></div></div>
								<div class="h-14 rounded-md bg-white p-2"><div class="h-2 w-6 rounded bg-brand-100"></div><div class="mt-2 h-3 w-10 rounded bg-ink/70"></div></div>
								<div class="h-14 rounded-md bg-white p-2"><div class="h-2 w-6 rounded bg-brand-100"></div><div class="mt-2 h-3 w-8 rounded bg-ink/70"></div></div>
							</div>
							<div class="space-y-1.5 rounded-md bg-white p-2">
								<div class="h-3 rounded bg-brand-50"></div>
								{#each Array(5) as _, i}
									<div class="flex gap-2"><div class="h-2 w-10 rounded bg-ink/20"></div><div class="h-2 flex-1 rounded bg-ink/10"></div><div class="h-2 rounded bg-brand-500/40" style="width: {20 + i * 6}px"></div></div>
								{/each}
							</div>
						</div>
					</div>
				</div>
				<div class="mx-[-1.5rem] h-3 rounded-b-xl bg-ink/90"></div>
			</div>

			{#each floaters as f}
				<div class="floater absolute" style="top: {f.top}%; left: {f.left}%; animation-delay: {f.delay}s">
					<div class="hex grid size-14 place-items-center bg-lime/90 text-forest shadow-lg shadow-lime/20">
						<f.icon size={22} />
					</div>
				</div>
			{/each}

			<div class="absolute bottom-0 left-0 z-10">
				<p class="text-4xl leading-tight font-extrabold tracking-tight text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.45)]">
					One till for every<br /><span class="text-lime">kind of business.</span>
				</p>
				<ul class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
					<li class="flex items-center gap-1.5"><ShoppingCart size={15} /> Retail</li>
					<li class="flex items-center gap-1.5"><UtensilsCrossed size={15} /> Restaurants</li>
					<li class="flex items-center gap-1.5"><Pill size={15} /> Pharmacies</li>
					<li class="flex items-center gap-1.5"><Scissors size={15} /> Salons</li>
				</ul>
			</div>
		</section>

		<!-- Right: frosted form panel -->
		<main class="auth-panel w-full rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
			<div class="mb-8 flex items-center justify-center gap-2.5 text-xl font-semibold tracking-wide">
				<span class="hex grid size-10 place-items-center bg-lime text-forest"><ShoppingCart size={18} /></span>
				{PUBLIC_APP_NAME}
			</div>
			{@render children()}
			<p class="mt-8 text-center text-xs text-white/50">by RiG_Designs</p>
		</main>
	</div>
</div>

<style>
	.hex {
		clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
	}
	.floater {
		animation: float 6s ease-in-out infinite;
	}
	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-12px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.floater {
			animation: none;
		}
	}

	/* Text on the glass panel is light; white cards inside it keep dark text */
	.auth-panel :global(.text-muted) {
		color: rgb(255 255 255 / 0.7);
	}
	.auth-panel :global(.label) {
		color: white;
	}
	.auth-panel :global(.card),
	.auth-panel :global(.btn-secondary) {
		color: var(--color-ink);
	}
	.auth-panel :global(.card .text-muted) {
		color: var(--color-muted);
	}
	.auth-panel :global(a.link) {
		color: var(--color-lime);
		font-weight: 500;
	}
	.auth-panel :global(.alert-error) {
		background: rgb(254 226 226 / 0.95);
	}

	/* White input boxes with an icon on the left, like the design */
	.auth-panel :global(.field) {
		position: relative;
	}
	.auth-panel :global(.field > svg) {
		position: absolute;
		top: 50%;
		left: 1rem;
		transform: translateY(-50%);
		color: var(--color-brand-500);
		pointer-events: none;
	}
	.auth-panel :global(.field > .input) {
		padding-top: 0.85rem;
		padding-bottom: 0.85rem;
		padding-left: 2.75rem;
		border-color: transparent;
	}
</style>
