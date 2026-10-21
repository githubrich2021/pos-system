import { UtensilsCrossed } from '@lucide/svelte';
import type { PosModule } from '#lib/core/modules.ts';

export const restaurant: PosModule = {
	key: 'restaurant',
	name: 'Restaurant / bar',
	description: 'Table map, open tabs, order modifiers, kitchen tickets and split bills.',
	icon: UtensilsCrossed,
	status: 'preview',
	phase: 3,
	nav: [{ label: 'Tables', href: '/restaurant', icon: UtensilsCrossed, permission: 'sales.create' }],
	permissions: {
		'restaurant.tables.manage': 'Edit the table map',
		'restaurant.kitchen.view': 'View kitchen orders'
	},
	productFields: [{ key: 'kitchen_station', label: 'Kitchen station', type: 'text' }]
};
