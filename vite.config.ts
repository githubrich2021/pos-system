import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// adapter-node builds a standalone Node server. The same server will later run
			// inside the desktop (Tauri) app and on the cloud host.
			adapter: adapter(),

			// The production server assumes HTTPS (as it will be in the cloud). These let you also
			// run the built app locally over plain http with `npm start` / `npm run preview`.
			csrf: {
				trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4173']
			}
		})
	]
});
