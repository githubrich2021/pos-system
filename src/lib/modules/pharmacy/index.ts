import { Pill } from '@lucide/svelte';
import type { PosModule } from '#lib/core/modules.ts';

export const pharmacy: PosModule = {
	key: 'pharmacy',
	name: 'Pharmacy',
	description: 'Batch and expiry tracking, first-expiry-first-out selling and prescription records.',
	icon: Pill,
	status: 'preview',
	phase: 3,
	nav: [{ label: 'Batches & expiry', href: '/pharmacy', icon: Pill, permission: 'products.view' }],
	permissions: {
		'pharmacy.batches.manage': 'Manage batches and expiry dates',
		'pharmacy.prescriptions.manage': 'Record prescriptions'
	},
	productFields: [
		{ key: 'generic_name', label: 'Generic name', type: 'text' },
		{ key: 'requires_prescription', label: 'Requires prescription', type: 'boolean' }
	]
};
