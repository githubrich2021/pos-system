import { Store, ShoppingCart } from '@lucide/svelte';
import type { PosModule } from '#lib/core/modules.ts';

export const retail: PosModule = {
	key: 'retail',
	name: 'Retail',
	description: 'Supermarkets, provision stores and boutiques: barcodes, wholesale prices and promotions.',
	icon: Store,
	status: 'available',
	phase: 1,
	nav: [{ label: 'Sell', href: '/sell', icon: ShoppingCart, permission: 'sales.create' }],
	permissions: {
		'retail.promotions.manage': 'Create promotions (buy 2 get 1, etc.)'
	},
	productFields: [{ key: 'wholesale_price', label: 'Wholesale price', type: 'money' }]
};
