import { embed } from './embeddings';
import { getAllChunksWithEmbeddings, getHighlights } from '$lib/db';

export interface SearchResult {
	chunkId: string;
	bookId: string;
	bookTitle: string;
	pageNumber: number;
	text: string;
	score: number;
	highlightId?: string;
	note?: string;
}

export interface SearchResults {
	highlights: SearchResult[];
	chunks: SearchResult[];
	queryTimeMs: number;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0, normA = 0, normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function search(
	query: string,
	options: { minScore?: number; maxHighlights?: number; maxChunks?: number; bookId?: string } = {}
): Promise<SearchResults> {
	const start = Date.now();
	const { minScore = 0.3, maxHighlights = 25, maxChunks = 25 } = options;

	// Compute query embedding
	const queryEmbedding = await embed(query, 'query');

	// Get all chunks with embeddings
	const allChunks = getAllChunksWithEmbeddings();

	// Get all highlights
	const allHighlights = getHighlights(options.bookId);

	// Score all chunks
	const scored = allChunks
		.filter(c => !options.bookId || c.bookId === options.bookId)
		.map(chunk => ({
			chunkId: chunk.id,
			bookId: chunk.bookId,
			bookTitle: chunk.bookTitle,
			pageNumber: chunk.pageNumber,
			text: chunk.text.slice(0, 200),
			score: cosineSimilarity(queryEmbedding, chunk.embedding)
		}))
		.filter(r => r.score >= minScore)
		.sort((a, b) => b.score - a.score);

	// Match chunks with highlights
	const highlightResults: SearchResult[] = [];
	const chunkResults: SearchResult[] = [];

	for (const result of scored) {
		// Check if this chunk overlaps with any highlight
		const matchingHighlight = allHighlights.find(
			h => h.bookId === result.bookId && h.pageNumber === result.pageNumber &&
				result.text.includes(h.text.slice(0, 50))
		);

		if (matchingHighlight && highlightResults.length < maxHighlights) {
			highlightResults.push({
				...result,
				highlightId: matchingHighlight.id,
				note: matchingHighlight.note || undefined
			});
		} else if (chunkResults.length < maxChunks) {
			chunkResults.push(result);
		}
	}

	return {
		highlights: highlightResults,
		chunks: chunkResults,
		queryTimeMs: Date.now() - start
	};
}
