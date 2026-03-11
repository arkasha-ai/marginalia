import { v4 as uuidv4 } from 'uuid';
import { getParser } from './book-parser';
import { embed, initEmbeddings, disposeEmbeddings } from './embeddings';
import { insertChunks, updateBook, getBook, getLastIndexedPage } from '$lib/db';
import type { Chunk } from '$lib/db/schema';

export interface IndexResult {
	bookId: string;
	totalChunks: number;
	totalPages: number;
	skippedPages: number;
	durationMs: number;
	status: 'completed' | 'error' | 'cancelled';
	error?: string;
}

export interface IndexProgress {
	bookId: string;
	bookTitle: string;
	currentPage: number;
	totalPages: number;
	chunks: number;
	percent: number;
	stage: 'loading_model' | 'indexing' | 'done' | 'error';
}

let cancelled = false;

export function cancelIndexing() {
	cancelled = true;
}

/** Detect iOS for memory-conservative settings */
function isIOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Memory-aware batching: much more conservative on iOS WebView
const IOS = typeof navigator !== 'undefined' && isIOS();
const BATCH_SIZE = IOS ? 1 : 3;           // 1 chunk at a time on iOS
const BATCH_PAUSE_MS = IOS ? 300 : 150;   // longer pause for GC on iOS
const PAGE_PAUSE_MS = IOS ? 200 : 50;     // longer pause between pages

function splitIntoChunks(text: string): string[] {
	if (!text.trim()) return [];

	// Split by paragraphs
	const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
	const chunks: string[] = [];

	for (const para of paragraphs) {
		const trimmed = para.trim();
		if (trimmed.length < 50) {
			// Merge short paragraphs with previous
			if (chunks.length > 0) {
				chunks[chunks.length - 1] += ' ' + trimmed;
			} else {
				chunks.push(trimmed);
			}
		} else if (trimmed.length > 512) {
			// Split long paragraphs by sentences
			const sentences = trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed];
			let current = '';
			for (const sentence of sentences) {
				if ((current + sentence).length > 400 && current) {
					chunks.push(current.trim());
					current = sentence;
				} else {
					current += sentence;
				}
			}
			if (current.trim()) chunks.push(current.trim());
		} else {
			chunks.push(trimmed);
		}
	}

	return chunks.filter(c => c.trim().length > 10);
}

/** Pause to yield to GC and UI */
function pause(ms: number): Promise<void> {
	return new Promise(r => setTimeout(r, ms));
}

export async function indexBook(
	bookId: string,
	fileData: ArrayBuffer,
	onProgress?: (progress: IndexProgress) => void
): Promise<IndexResult> {
	cancelled = false;
	const start = Date.now();
	const book = getBook(bookId);
	if (!book) throw new Error('Book not found');

	// Init embeddings model (loads in Worker if available)
	onProgress?.({ bookId, bookTitle: book.title, currentPage: 0, totalPages: book.totalPages, chunks: 0, percent: 0, stage: 'loading_model' });
	await initEmbeddings();

	const parser = getParser(book.filePath);
	let totalChunks = 0;
	let skippedPages = 0;
	const lastIndexed = getLastIndexedPage(bookId);

	updateBook(bookId, { indexingStatus: 'in_progress' });

	try {
		for (let page = lastIndexed + 1; page <= book.totalPages; page++) {
			if (cancelled) {
				return {
					bookId, totalChunks, totalPages: page - 1,
					skippedPages, durationMs: Date.now() - start,
					status: 'cancelled'
				};
			}

			try {
				const pageText = await parser.extractText(fileData, page);
				if (!pageText.fullText.trim()) {
					skippedPages++;
					continue;
				}

				const textChunks = splitIntoChunks(pageText.fullText);
				const chunksToInsert: Omit<Chunk, 'createdAt'>[] = [];

				// Process chunks in small batches with pauses
				for (let i = 0; i < textChunks.length; i++) {
					let embedding: Float32Array | null = null;
					try {
						embedding = await embed(textChunks[i], 'passage');
					} catch {
						// Embedding failed, store chunk without embedding
					}

					chunksToInsert.push({
						id: uuidv4(),
						bookId,
						pageNumber: page,
						chunkIndex: i,
						text: textChunks[i],
						embedding,
						charOffsetStart: null,
						charOffsetEnd: null
					});

					// Pause every BATCH_SIZE chunks to let iOS reclaim memory
					if ((i + 1) % BATCH_SIZE === 0) {
						await pause(BATCH_PAUSE_MS);
					}
				}

				if (chunksToInsert.length > 0) {
					insertChunks(chunksToInsert);
					totalChunks += chunksToInsert.length;
				}
			} catch {
				skippedPages++;
			}

			const percent = Math.round((page / book.totalPages) * 100);
			updateBook(bookId, { indexingProgress: page / book.totalPages });
			onProgress?.({ bookId, bookTitle: book.title, currentPage: page, totalPages: book.totalPages, chunks: totalChunks, percent, stage: 'indexing' });

			// Yield between pages
			await pause(PAGE_PAUSE_MS);
		}

		updateBook(bookId, { indexingStatus: 'completed', indexingProgress: 1 });

		// Free worker memory after indexing completes
		disposeEmbeddings();

		return {
			bookId, totalChunks, totalPages: book.totalPages,
			skippedPages, durationMs: Date.now() - start,
			status: 'completed'
		};
	} catch (e: any) {
		updateBook(bookId, { indexingStatus: 'error' });
		return {
			bookId, totalChunks, totalPages: book.totalPages,
			skippedPages, durationMs: Date.now() - start,
			status: 'error', error: e.message
		};
	}
}
