<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		goto('/kiosk');
	});
</script>

<div style="display: flex; height: 100vh; align-items: center; justify-content: center; font-family: sans-serif;">
	<p>Mengalihkan ke Kiosk...</p>
</div>
