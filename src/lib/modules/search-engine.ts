import { embed, initEmbeddings, isEmbeddingsReady } from './embeddings';
import { getAllChunksWithEmbeddings, getHighlights } from '$lib/db';
import { getDb } from '$lib/db';

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

/**
 * Simple text relevance score based on term frequency.
 * Normalizes query into lowercase terms, counts matches in text.
 */
function textRelevanceScore(query: string, text: string): number {
	const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
	if (queryTerms.length === 0) return 0;
	const lowerText = text.toLowerCase();
	let matched = 0;
	for (const term of queryTerms) {
		if (lowerText.includes(term)) matched++;
	}
	return matched / queryTerms.length;
}

/**
 * Text-only fulltext search fallback (used when embeddings are unavailable, e.g. iOS).
 * Searches chunks by substring match and scores by term overlap.
 */
function searchTextOnly(
	query: string,
	options: { maxHighlights?: number; maxChunks?: number; bookId?: string }
): SearchResults {
	const start = Date.now();
	const { maxHighlights = 25, maxChunks = 25 } = options;
	const db = getDb();

	// Search chunks using LIKE for each query term (AND logic)
	const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
	if (queryTerms.length === 0) {
		return { highlights: [], chunks: [], queryTimeMs: Date.now() - start };
	}

	// Build WHERE clause: text LIKE '%term1%' AND text LIKE '%term2%' ...
	const whereParts: string[] = [];
	const params: any[] = [];
	if (options.bookId) {
		whereParts.push('c.book_id = ?');
		params.push(options.bookId);
	}
	for (const term of queryTerms) {
		whereParts.push('LOWER(c.text) LIKE ?');
		params.push(`%${term}%`);
	}

	const sql = `
		SELECT c.id, c.book_id, b.title as book_title, c.page_number, c.text
		FROM chunks c JOIN books b ON c.book_id = b.id
		WHERE ${whereParts.join(' AND ')}
		LIMIT 100
	`;

	const stmt = db.prepare(sql);
	stmt.bind(params);
	const results: SearchResult[] = [];
	while (stmt.step()) {
		const row = stmt.getAsObject();
		results.push({
			chunkId: row.id as string,
			bookId: row.book_id as string,
			bookTitle: row.book_title as string,
			pageNumber: row.page_number as number,
			text: (row.text as string).slice(0, 200),
			score: textRelevanceScore(query, row.text as string)
		});
	}
	stmt.free();

	// Sort by relevance score
	results.sort((a, b) => b.score - a.score);

	// Split into highlights and chunks
	const allHighlights = getHighlights(options.bookId);
	const highlightResults: SearchResult[] = [];
	const chunkResults: SearchResult[] = [];

	for (const result of results) {
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

	return { highlights: highlightResults, chunks: chunkResults, queryTimeMs: Date.now() - start };
}

export async function search(
	query: string,
	options: { minScore?: number; maxHighlights?: number; maxChunks?: number; bookId?: string } = {}
): Promise<SearchResults> {
	const start = Date.now();
	const { minScore = 0.3, maxHighlights = 25, maxChunks = 25 } = options;

	// Try to init embeddings (will skip on iOS)
	await initEmbeddings();

	// If embeddings unavailable — use text-only search
	if (!isEmbeddingsReady()) {
		return searchTextOnly(query, options);
	}

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
