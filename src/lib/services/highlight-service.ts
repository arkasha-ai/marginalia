import { v4 as uuidv4 } from 'uuid';
import {
	insertHighlight,
	updateHighlight as updateHighlightDb,
	deleteHighlight as deleteHighlightDb,
	getHighlightsByPage as getHighlightsByPageDb,
	getHighlights as getHighlightsDb
} from '$lib/db';
import type { Highlight, HighlightWithBook } from '$lib/db/schema';

export function createHighlight(data: {
	bookId: string;
	pageNumber: number;
	text: string;
	startOffset: number;
	endOffset: number;
	note?: string;
}): Highlight {
	return insertHighlight({
		id: uuidv4(),
		bookId: data.bookId,
		pageNumber: data.pageNumber,
		text: data.text,
		startOffset: data.startOffset,
		endOffset: data.endOffset,
		color: 'yellow',
		note: data.note || null
	});
}

export function updateNote(highlightId: string, note: string | null): void {
	updateHighlightDb(highlightId, { note });
}

export function removeHighlight(highlightId: string): void {
	deleteHighlightDb(highlightId);
}

export function getForPage(bookId: string, pageNumber: number): Highlight[] {
	return getHighlightsByPageDb(bookId, pageNumber);
}

export function getAllHighlights(bookId?: string): HighlightWithBook[] {
	return getHighlightsDb(bookId);
}
