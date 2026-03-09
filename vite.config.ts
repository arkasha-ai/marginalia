import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['sql.js', '@huggingface/transformers', 'onnxruntime-web']
	},
	server: {
		fs: {
			allow: ['static', 'node_modules']
		}
	}
});
