<script lang="ts">
	import { formatQty, movementSourceHref, STOCK_REASON_LABELS } from '#lib/core/stock.ts';

	interface Movement {
		id: string;
		productId: string;
		product: string;
		unit: string;
		quantity: number;
		reason: string;
		refId: string | null;
		note: string | null;
		user: string | null;
		createdAt: Date | string;
	}

	let { movements, showProduct = true }: { movements: Movement[]; showProduct?: boolean } = $props();

	const when = (d: Date | string) =>
		new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<table class="table-base">
	<thead>
		<tr>
			<th>When</th>
			{#if showProduct}<th>Product</th>{/if}
			<th>Reason</th>
			<th>By</th>
			<th class="text-right">Change</th>
		</tr>
	</thead>
	<tbody>
		{#each movements as m (m.id)}
			{@const href = movementSourceHref(m.reason, m.refId)}
			<tr>
				<td class="whitespace-nowrap text-muted tabular-nums">{when(m.createdAt)}</td>
				{#if showProduct}
					<td><a class="font-medium hover:underline" href="/stock/movements?product={m.productId}">{m.product}</a></td>
				{/if}
				<td>
					{#if href}<a class="hover:underline" {href}>{STOCK_REASON_LABELS[m.reason] ?? m.reason}</a>
					{:else}{STOCK_REASON_LABELS[m.reason] ?? m.reason}{/if}
					{#if m.note}<p class="text-xs text-muted">{m.note}</p>{/if}
				</td>
				<td class="text-muted">{m.user ?? '—'}</td>
				<td class="text-right font-medium whitespace-nowrap tabular-nums {m.quantity < 0 ? 'text-red-700' : 'text-brand-700'}">
					{m.quantity > 0 ? '+' : ''}{formatQty(m.quantity)} {m.unit}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
