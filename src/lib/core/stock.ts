/** Labels for stock movement reasons, shared by the server and the screens. */
export const STOCK_REASON_LABELS: Record<string, string> = {
	opening: 'Opening stock',
	purchase: 'Received',
	sale: 'Sold',
	refund: 'Returned / void',
	adjustment: 'Correction',
	damage: 'Damaged',
	loss: 'Lost / stolen',
	expired: 'Expired',
	stock_take: 'Stock take',
	transfer_in: 'Transfer in',
	transfer_out: 'Transfer out'
};

/**
 * Reasons a manager can pick when adjusting stock by hand.
 * "out" reasons can only remove stock; a correction can go either way.
 */
export const ADJUST_REASONS = [
	{ key: 'damage', label: 'Damaged', direction: 'out' },
	{ key: 'expired', label: 'Expired', direction: 'out' },
	{ key: 'loss', label: 'Lost or stolen', direction: 'out' },
	{ key: 'adjustment', label: 'Correction (miscount, found stock…)', direction: 'both' }
] as const;

export type AdjustReason = (typeof ADJUST_REASONS)[number]['key'];

/** Formats a stock quantity without trailing zeros: 12, 1.5, -0.25 */
export function formatQty(q: number): string {
	return Number(q.toFixed(3)).toString();
}

/** Where a movement came from, so history rows can link to the sale, delivery or count. */
export function movementSourceHref(reason: string, refId: string | null): string | null {
	if (!refId) return null;
	if (reason === 'sale' || reason === 'refund') return `/sales/${refId}`;
	if (reason === 'purchase') return `/stock/purchases/${refId}`;
	if (reason === 'stock_take') return `/stock/takes/${refId}`;
	return null;
}
