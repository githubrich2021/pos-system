<script lang="ts">
	/**
	 * Net sales per day as columns. One series, so no legend; the section title names it.
	 * Hover (or tap) a column for the day's numbers. The same numbers are in the table below.
	 */
	interface Day {
		day: string;
		count: number;
		sales: number;
		refunds: number;
		net: number;
	}
	let { days, format }: { days: Day[]; format: (minor: number) => string } = $props();

	const H = 220;
	const PAD = { top: 12, right: 8, bottom: 28, left: 52 };
	let width = $state(640);
	let hover = $state<number | null>(null);

	const plotW = $derived(Math.max(0, width - PAD.left - PAD.right));
	const plotH = H - PAD.top - PAD.bottom;

	/** Clean axis ticks: 0, then round steps up to the largest value. */
	const scale = $derived.by(() => {
		const max = Math.max(0, ...days.map((d) => d.net));
		const min = Math.min(0, ...days.map((d) => d.net));
		const span = max - min || 100;
		const rough = span / 4;
		const mag = 10 ** Math.floor(Math.log10(rough));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? mag * 10;
		const top = Math.ceil(max / step) * step || step;
		const bottom = Math.floor(min / step) * step;
		const ticks: number[] = [];
		for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v));
		const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * plotH;
		return { ticks, y };
	});

	const band = $derived(days.length ? plotW / days.length : 0);
	const barW = $derived(Math.max(2, Math.min(24, band - 2)));
	const x = (i: number) => PAD.left + i * band + band / 2;

	/** A column with a 4px rounded data end and a square end on the baseline. */
	function column(i: number, v: number) {
		const y0 = scale.y(0);
		const y1 = scale.y(v);
		const h = Math.abs(y1 - y0);
		if (h < 0.5) return '';
		const r = Math.min(4, h, barW / 2);
		const l = x(i) - barW / 2;
		const rgt = l + barW;
		if (v >= 0) {
			return `M${l},${y0} V${y1 + r} Q${l},${y1} ${l + r},${y1} H${rgt - r} Q${rgt},${y1} ${rgt},${y1 + r} V${y0} Z`;
		}
		return `M${l},${y0} V${y1 - r} Q${l},${y1} ${l + r},${y1} H${rgt - r} Q${rgt},${y1} ${rgt},${y1 - r} V${y0} Z`;
	}

	const compact = (minor: number) => {
		const v = minor / 100;
		const a = Math.abs(v);
		if (a >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
		if (a >= 1000) return `${+(v / 1000).toFixed(1)}K`;
		return String(Math.round(v));
	};
	const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', opts);

	// Label only as many days as fit (about one per 56px)
	const labelEvery = $derived(Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(plotW / 56)))));
	const tip = $derived(hover === null ? null : days[hover]);
</script>

<div class="relative" bind:clientWidth={width}>
	<svg {width} height={H} role="img" aria-label="Net sales per day">
		{#each scale.ticks as t (t)}
			<line x1={PAD.left} x2={width - PAD.right} y1={scale.y(t)} y2={scale.y(t)} class={t === 0 ? 'stroke-muted/40' : 'stroke-line'} stroke-width="1" />
			<text x={PAD.left - 8} y={scale.y(t)} dy="0.32em" text-anchor="end" class="fill-muted text-[11px] tabular-nums">{compact(t)}</text>
		{/each}

		{#each days as d, i (d.day)}
			<path d={column(i, d.net)} class={d.net < 0 ? 'fill-red-600' : hover === null || hover === i ? 'fill-brand-600' : 'fill-brand-600/45'} />
			{#if i % labelEvery === 0}
				<text x={x(i)} y={H - 8} text-anchor="middle" class="fill-muted text-[11px]">
					{dayLabel(d.day, days.length > 14 ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' })}
				</text>
			{/if}
			<!-- Hit area: the whole day's band, taller than the column -->
			<rect
				x={PAD.left + i * band}
				y={PAD.top}
				width={band}
				height={plotH}
				fill="transparent"
				role="presentation"
				onmouseenter={() => (hover = i)}
				onmouseleave={() => (hover = null)}
				ontouchstart={() => (hover = i)}
			/>
		{/each}
	</svg>

	{#if tip && hover !== null}
		<div
			class="pointer-events-none absolute top-0 z-10 w-48 rounded-xl border border-line bg-white p-3 text-xs shadow-lg"
			style="left: {Math.min(Math.max(x(hover) - 96, 0), width - 192)}px"
		>
			<p class="font-medium">{dayLabel(tip.day, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
			<dl class="mt-1.5 space-y-0.5 tabular-nums">
				<div class="flex justify-between"><dt class="text-muted">Net sales</dt><dd class="font-semibold">{format(tip.net)}</dd></div>
				<div class="flex justify-between"><dt class="text-muted">Sales ({tip.count})</dt><dd>{format(tip.sales)}</dd></div>
				{#if tip.refunds}<div class="flex justify-between"><dt class="text-muted">Refunds</dt><dd>−{format(tip.refunds)}</dd></div>{/if}
			</dl>
		</div>
	{/if}
</div>
