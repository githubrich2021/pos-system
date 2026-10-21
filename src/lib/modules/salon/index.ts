import { Scissors } from '@lucide/svelte';
import type { PosModule } from '#lib/core/modules.ts';

export const salon: PosModule = {
	key: 'salon',
	name: 'Salon / services',
	description: 'Appointment calendar, walk-in queue, staff assignment and commissions.',
	icon: Scissors,
	status: 'preview',
	phase: 4,
	nav: [{ label: 'Appointments', href: '/salon', icon: Scissors, permission: 'sales.create' }],
	permissions: {
		'salon.appointments.manage': 'Book and edit appointments',
		'salon.commissions.view': 'View staff commissions'
	},
	productFields: [{ key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' }]
};
