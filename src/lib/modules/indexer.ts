import { v4 as uuidv4 } from 'uuid';
import { getParser } from './book-parser';
import { embed } from './embeddings';
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

let cancelled = false;

export function cancelIndexing() {
	cancelled = true;
}

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

export async function indexBook(
	bookId: string,
	fileData: ArrayBuffer,
	onProgress?: (progress: number) => void
): Promise<IndexResult> {
	cancelled = false;
	const start = Date.now();
	const book = getBook(bookId);
	if (!book) throw new Error('Book not found');

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
				}

				if (chunksToInsert.length > 0) {
					insertChunks(chunksToInsert);
					totalChunks += chunksToInsert.length;
				}
			} catch {
				skippedPages++;
			}

			const progress = page / book.totalPages;
			updateBook(bookId, { indexingProgress: progress });
			onProgress?.(progress);

			// Yield to UI
			await new Promise(r => setTimeout(r, 0));
		}

		updateBook(bookId, { indexingStatus: 'completed', indexingProgress: 1 });
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
