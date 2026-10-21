<script lang="ts">
	import ComingSoon from '#lib/components/ComingSoon.svelte';
	import { retail } from '#lib/modules/retail/index.ts';
</script>

<svelte:head><title>{retail.name}</title></svelte:head>

<ComingSoon
	module={retail}
	features={['Search or scan items into the cart', 'Cash, MoMo, card and split payments', 'Hold and resume sales', 'Print or SMS receipts', 'Refunds and voids with manager approval', 'Works offline and syncs later']}
/>
