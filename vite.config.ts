import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['sql.js']
	},
	server: {
		fs: {
			allow: ['static']
		}
	}
});
