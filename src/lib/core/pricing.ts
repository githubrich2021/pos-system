/**
 * Sale maths, shared by the till screen (for the live preview) and the server
 * (which recalculates everything from database prices before saving).
 * All amounts are whole pesewas.
 */

export interface PriceLine {
	unitPrice: number;
	quantity: number;
	/** Tax rate in basis points (1500 = 15%), or null for no tax. */
	taxRateBp: number | null;
	/** true = the price already includes tax. */
	taxInclusive: boolean;
}

export interface PricedLine {
	gross: number;
	discount: number;
	tax: number;
	lineTotal: number;
}

export interface SaleTotals {
	lines: PricedLine[];
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	total: number;
}

export const roundQty = (q: number) => Math.round(q * 1000) / 1000;

export function calculateSale(lines: PriceLine[], cartDiscount = 0): SaleTotals {
	const gross = lines.map((l) => Math.round(l.unitPrice * l.quantity));
	const subtotal = gross.reduce((a, b) => a + b, 0);
	const discountTotal = Math.max(0, Math.min(Math.round(cartDiscount), subtotal));

	// Spread the cart discount across lines in proportion to their value,
	// so each line's tax is worked out on what the customer actually paid.
	const discounts = gross.map((g) => (subtotal ? Math.floor((discountTotal * g) / subtotal) : 0));
	let remainder = discountTotal - discounts.reduce((a, b) => a + b, 0);
	for (let i = discounts.length - 1; i >= 0 && remainder > 0; i--) {
		const room = gross[i] - discounts[i];
		const take = Math.min(room, remainder);
		discounts[i] += take;
		remainder -= take;
	}

	const priced = lines.map((l, i) => {
		const net = gross[i] - discounts[i];
		const rate = l.taxRateBp ?? 0;
		const tax = rate === 0 ? 0 : l.taxInclusive ? Math.round((net * rate) / (10000 + rate)) : Math.round((net * rate) / 10000);
		return { gross: gross[i], discount: discounts[i], tax, lineTotal: l.taxInclusive ? net : net + tax };
	});

	return {
		lines: priced,
		subtotal,
		discountTotal,
		taxTotal: priced.reduce((a, l) => a + l.tax, 0),
		total: priced.reduce((a, l) => a + l.lineTotal, 0)
	};
}

export const PAYMENT_METHODS = {
	cash: 'Cash',
	momo: 'Mobile money',
	card: 'Card',
	bank: 'Bank transfer'
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export interface TenderedPayment {
	method: PaymentMethod;
	amount: number;
	reference?: string;
}

/**
 * Checks payments against the total. Only cash can be over-paid (the difference is change);
 * MoMo, card and bank payments must not exceed what is owed.
 */
export function settlePayments(total: number, payments: TenderedPayment[]) {
	const cash = payments.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
	const nonCash = payments.filter((p) => p.method !== 'cash').reduce((a, p) => a + p.amount, 0);
	const paid = cash + nonCash;
	const remaining = Math.max(0, total - paid);
	const change = Math.max(0, paid - total);

	let error: string | null = null;
	if (payments.some((p) => !Number.isInteger(p.amount) || p.amount <= 0)) error = 'Each payment must be more than zero.';
	else if (nonCash > total) error = 'Mobile money, card and bank payments cannot be more than the total.';
	else if (paid < total) error = 'The payment does not cover the total.';
	else if (change > cash) error = 'Change can only be given from cash.';

	return { paid, remaining, change, cashTendered: cash, cashApplied: cash - change, error };
}
