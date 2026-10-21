/**
 * Money is always stored as whole numbers in the smallest unit (pesewas for GHS),
 * never as decimals, so 0.1 + 0.2 rounding errors can't creep into totals.
 *   GHS 12.50  ->  1250
 */
export function toMinor(amount: string | number): number {
	const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/,/g, '').trim());
	if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${amount}`);
	return Math.round(n * 100);
}

export function fromMinor(minor: number): number {
	return minor / 100;
}

export function formatMoney(minor: number, currency = 'GHS', locale = 'en-GH'): string {
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}
