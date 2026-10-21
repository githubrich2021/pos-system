<script lang="ts">
	import ComingSoon from '#lib/components/ComingSoon.svelte';
	import { pharmacy } from '#lib/modules/pharmacy/index.ts';
</script>

<svelte:head><title>{pharmacy.name}</title></svelte:head>

<ComingSoon
	module={pharmacy}
	features={['Batch numbers and expiry dates', 'Expiry alerts', 'First-expiry-first-out selling', 'Prescription records', 'Controlled-item log']}
/>
