import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Serve model from our own static files — no HuggingFace dependency
env.localModelPath = '/models/';
env.allowRemoteModels = false;

let extractor: FeatureExtractionPipeline | null = null;
let loading = false;
let loadPromise: Promise<void> | null = null;

export async function initEmbeddings(): Promise<void> {
	if (extractor) return;
	if (loadPromise) return loadPromise;

	loading = true;
	loadPromise = (async () => {
		try {
			extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
				dtype: 'q8' as any
			});
			loading = false;
		} catch (e) {
			loading = false;
			loadPromise = null;
			throw e;
		}
	})();
	return loadPromise;
}

export function isEmbeddingsReady(): boolean {
	return extractor !== null;
}

export function isEmbeddingsLoading(): boolean {
	return loading;
}

export async function embed(text: string, type: 'query' | 'passage'): Promise<Float32Array> {
	if (!extractor) throw new Error('Embeddings model not initialized');
	const prefix = type === 'query' ? 'query: ' : 'passage: ';
	const result = await extractor(prefix + text, { pooling: 'mean', normalize: true });
	return new Float32Array(result.data as Float64Array);
}

export async function embedBatch(texts: string[], type: 'passage'): Promise<Float32Array[]> {
	if (!extractor) throw new Error('Embeddings model not initialized');
	const prefix = type === 'passage' ? 'passage: ' : 'query: ';
	const results: Float32Array[] = [];
	// Process one by one to avoid memory issues
	for (const text of texts) {
		const result = await extractor(prefix + text, { pooling: 'mean', normalize: true });
		results.push(new Float32Array(result.data as Float64Array));
	}
	return results;
}
