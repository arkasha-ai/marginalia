/// Web Worker for ONNX embeddings — runs in separate thread to avoid OOM in main WKWebView process

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Serve model from our own static files — no HuggingFace dependency
env.localModelPath = '/models/';
env.allowLocalModels = true;
env.allowRemoteModels = false;

// Point ONNX Runtime to local WASM files
env.backends.onnx.wasm.wasmPaths = '/ort-wasm/';

let extractor: FeatureExtractionPipeline | null = null;

async function initModel(): Promise<void> {
	if (extractor) return;
	extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
		dtype: 'q8' as any
	});
}

async function embedText(text: string, type: 'query' | 'passage'): Promise<Float32Array> {
	if (!extractor) throw new Error('Model not initialized');
	const prefix = type === 'query' ? 'query: ' : 'passage: ';
	const result = await extractor(prefix + text, { pooling: 'mean', normalize: true });
	return new Float32Array(result.data as Float64Array);
}

// Message handler
self.onmessage = async (e: MessageEvent) => {
	const { id, action, text, type } = e.data;

	try {
		if (action === 'init') {
			await initModel();
			self.postMessage({ id, ok: true });
		} else if (action === 'embed') {
			const embedding = await embedText(text, type);
			// Transfer the ArrayBuffer for zero-copy
			self.postMessage({ id, ok: true, embedding }, [embedding.buffer] as any);
		} else if (action === 'ping') {
			self.postMessage({ id, ok: true, ready: !!extractor });
		}
	} catch (err: any) {
		self.postMessage({ id, ok: false, error: err.message });
	}
};
