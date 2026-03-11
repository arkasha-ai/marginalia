/**
 * Embeddings proxy — delegates to Web Worker for memory isolation.
 * Falls back to main-thread if Worker unavailable (e.g. old browsers).
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

let worker: Worker | null = null;
let msgId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let workerReady = false;
let workerFailed = false;
let loading = false;

// Fallback main-thread extractor (used only if Worker fails)
let fallbackExtractor: FeatureExtractionPipeline | null = null;

function sendToWorker<T = any>(action: string, data: Record<string, any> = {}): Promise<T> {
	return new Promise((resolve, reject) => {
		if (!worker) return reject(new Error('Worker not available'));
		const id = ++msgId;
		pending.set(id, { resolve, reject });
		worker.postMessage({ id, action, ...data });

		// Timeout after 60s (model loading can be slow)
		setTimeout(() => {
			if (pending.has(id)) {
				pending.delete(id);
				reject(new Error('Worker timeout'));
			}
		}, 60000);
	});
}

function handleWorkerMessage(e: MessageEvent) {
	const { id, ok, error, ...rest } = e.data;
	const p = pending.get(id);
	if (!p) return;
	pending.delete(id);
	if (ok) {
		p.resolve(rest);
	} else {
		p.reject(new Error(error || 'Worker error'));
	}
}

function tryCreateWorker(): boolean {
	try {
		worker = new Worker(
			new URL('./embedding-worker.ts', import.meta.url),
			{ type: 'module' }
		);
		worker.onmessage = handleWorkerMessage;
		worker.onerror = (e) => {
			console.warn('[embeddings] Worker error, falling back to main thread:', e.message);
			workerFailed = true;
			worker?.terminate();
			worker = null;
		};
		return true;
	} catch (e) {
		console.warn('[embeddings] Worker creation failed, using main thread:', e);
		workerFailed = true;
		return false;
	}
}

async function initFallback(): Promise<void> {
	if (fallbackExtractor) return;
	env.localModelPath = '/models/';
	env.allowLocalModels = true;
	env.allowRemoteModels = false;
	// v2: set WASM paths (v2 uses env.backends.onnx.wasm or direct ort config)
	try { env.backends.onnx.wasm.wasmPaths = '/ort-wasm/'; } catch {
		// v2 may not have this path — WASM files should resolve from default location
	}
	fallbackExtractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
		quantized: true
	});
}

/** Detect iOS for memory-safe decisions */
function isIOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function initEmbeddings(): Promise<void> {
	if (workerReady || fallbackExtractor) return;
	loading = true;

	try {
		if (!workerFailed && (worker || tryCreateWorker())) {
			await sendToWorker('init');
			workerReady = true;
			loading = false;
			return;
		}
	} catch (e) {
		console.warn('[embeddings] Worker init failed, falling back:', e);
		workerFailed = true;
		worker?.terminate();
		worker = null;
	}

	// Fallback to main thread (desktop only)
	await initFallback();
	loading = false;
}

export function isEmbeddingsReady(): boolean {
	return workerReady || fallbackExtractor !== null;
}

export function isEmbeddingsLoading(): boolean {
	return loading;
}

export async function embed(text: string, type: 'query' | 'passage'): Promise<Float32Array> {
	if (workerReady && worker) {
		const result = await sendToWorker<{ embedding: Float32Array }>('embed', { text, type });
		return result.embedding;
	}

	if (fallbackExtractor) {
		const prefix = type === 'query' ? 'query: ' : 'passage: ';
		const result = await fallbackExtractor(prefix + text, { pooling: 'mean', normalize: true });
		return new Float32Array(result.data as Float64Array);
	}

	throw new Error('Embeddings not initialized');
}

export async function embedBatch(texts: string[], type: 'passage'): Promise<Float32Array[]> {
	const results: Float32Array[] = [];
	for (const text of texts) {
		results.push(await embed(text, type));
	}
	return results;
}

/**
 * Terminate the worker and free memory.
 * Call after indexing is done to release ONNX runtime in the worker thread.
 */
export function disposeEmbeddings(): void {
	if (worker) {
		worker.terminate();
		worker = null;
		workerReady = false;
	}
	fallbackExtractor = null;
}
