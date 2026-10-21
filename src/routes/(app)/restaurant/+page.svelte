<script lang="ts">
	import ComingSoon from '#lib/components/ComingSoon.svelte';
	import { restaurant } from '#lib/modules/restaurant/index.ts';
</script>

<svelte:head><title>{restaurant.name}</title></svelte:head>

<ComingSoon
	module={restaurant}
	features={['Table map and open tabs', 'Order modifiers (no pepper, extra meat)', 'Kitchen and bar tickets', 'Split bills', 'Takeaway and delivery orders', 'Recipes that deduct ingredients']}
/>
