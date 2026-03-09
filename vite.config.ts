import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['sql.js', '@huggingface/transformers', 'onnxruntime-web']
	},
	server: {
		headers: {
			// Required for SharedArrayBuffer (ONNX threading)
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		},
		fs: {
			allow: ['static', 'node_modules']
		}
	}
});
