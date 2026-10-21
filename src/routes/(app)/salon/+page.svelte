<script lang="ts">
	import ComingSoon from '#lib/components/ComingSoon.svelte';
	import { salon } from '#lib/modules/salon/index.ts';
</script>

<svelte:head><title>{salon.name}</title></svelte:head>

<ComingSoon
	module={salon}
	features={['Appointment calendar', 'Walk-in queue', 'Assign staff to services', 'Staff commissions', 'SMS reminders']}
/>
