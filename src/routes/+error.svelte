<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex min-h-screen items-center justify-center p-6">
	<div class="card max-w-md p-8 text-center">
		<p class="text-5xl font-semibold text-brand-600">{page.status}</p>
		<p class="mt-3 text-ink">{page.error?.message}</p>
		<a href="/" class="btn-secondary mt-6">Back to start</a>
	</div>
</div>
