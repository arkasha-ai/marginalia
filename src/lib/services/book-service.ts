import { v4 as uuidv4 } from 'uuid';
import { getParser, getExtension } from '$lib/modules/book-parser';
import { insertBook, updateBook, deleteBook, getBooks, getBook, getIncompleteBooks, getBookFileData } from '$lib/db';
import { indexBook } from '$lib/modules/indexer';
import { indexingProgress } from '$lib/stores/indexing';
import type { Book } from '$lib/db/schema';

// In-memory file cache (weak — evicted when memory pressure rises)
const fileStore = new Map<string, ArrayBuffer>();

/** Detect iOS / Capacitor for memory-conservative paths */
function isIOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getFileData(filePath: string): ArrayBuffer | undefined {
	return fileStore.get(filePath);
}

/**
 * Get file data, falling back to DB if not in memory.
 * On iOS: reads from DB every time to avoid holding large ArrayBuffers in memory.
 * On desktop: caches in memory for performance.
 */
export function getFileDataWithFallback(bookId: string, filePath: string): ArrayBuffer | undefined {
	let data = fileStore.get(filePath);
	if (data) return data;

	// Load from DB
	const dbData = getBookFileData(bookId);
	if (dbData) {
		// On desktop, keep in memory; on iOS, let it be GC'd after use
		if (!isIOS()) {
			fileStore.set(filePath, dbData);
		}
		return dbData;
	}
	return undefined;
}

/** Evict a file from memory cache (call after writing to DB) */
export function evictFileData(filePath: string): void {
	fileStore.delete(filePath);
}

export async function addBook(file: File): Promise<Book> {
	const ext = getExtension(file.name);
	if (ext !== 'pdf' && ext !== 'epub' && ext !== 'fb2') {
		throw new Error('Неподдерживаемый формат. Поддерживаются: PDF, EPUB, FB2');
	}

	const fileData = await file.arrayBuffer();
	const parser = getParser(file.name);

	const metadata = await parser.getMetadata(fileData);
	let coverDataUrl: string | null = null;
	try {
		coverDataUrl = await parser.generateCover(fileData);
	} catch {
		// Cover generation failed — ok
	}

	const bookId = uuidv4();
	const filePath = `books/${bookId}.${ext}`;

	const title = metadata.title || file.name.replace(/\.[^.]+$/, '');

	// Write to DB first (fileData as blob)
	const book = insertBook({
		id: bookId,
		title,
		filePath,
		fileData: new Uint8Array(fileData),
		format: metadata.format,
		coverDataUrl,
		totalPages: metadata.totalPages,
		lastReadPage: 1,
		indexingStatus: 'pending',
		indexingProgress: 0,
		fileSizeBytes: file.size,
		lastOpenedAt: null
	});

	// On iOS: don't keep fileData in memory — indexer will read from DB per-page
	// On desktop: keep in memory for snappy access
	if (!isIOS()) {
		fileStore.set(filePath, fileData);
	}
	// Explicitly null the reference so the large ArrayBuffer can be GC'd
	// (the DB already has a copy as Uint8Array blob)

	// Start indexing in background with a longer delay on iOS to let GC settle
	const delay = isIOS() ? 500 : 100;
	setTimeout(() => {
		// Read fileData from DB for indexing (avoids double memory on iOS)
		const dataForIndex = isIOS() ? getBookFileData(bookId) : (fileStore.get(filePath) ?? getBookFileData(bookId));
		if (!dataForIndex) {
			console.error('No file data for indexing', bookId);
			return;
		}
		indexBook(bookId, dataForIndex, (progress) => {
			indexingProgress.set(progress);
		}).then(() => {
			indexingProgress.set(null);
		}).catch((e) => {
			console.error(e);
			indexingProgress.set(null);
		});
	}, delay);

	return book;
}

export function removeBook(bookId: string): void {
	const book = getBook(bookId);
	if (book) {
		fileStore.delete(book.filePath);
		deleteBook(bookId);
	}
}

export function openBook(bookId: string): void {
	updateBook(bookId, { lastOpenedAt: new Date().toISOString() });
}

export function updateReadingPosition(bookId: string, page: number): void {
	updateBook(bookId, { lastReadPage: page });
}

export function getLibrary(): Book[] {
	return getBooks();
}

export function getBookById(bookId: string): Book | null {
	return getBook(bookId);
}

export { getFileData as getBookFileData };

export function resumeIndexing(): void {
	const incomplete = getIncompleteBooks();
	// Process books sequentially on iOS to avoid memory spikes
	let delay = isIOS() ? 1000 : 500;
	for (const book of incomplete) {
		const currentDelay = delay;
		setTimeout(() => {
			const fileData = getBookFileData(book.id);
			if (!fileData) {
				updateBook(book.id, { indexingStatus: 'error' });
				return;
			}
			// On desktop, cache in memory for reader; on iOS, let indexer use it and release
			if (!isIOS()) {
				fileStore.set(book.filePath, fileData);
			}
			indexBook(book.id, fileData, (progress) => {
				indexingProgress.set(progress);
			}).then(() => {
				indexingProgress.set(null);
			}).catch((e) => {
				console.error(e);
				indexingProgress.set(null);
			});
		}, currentDelay);
		delay += isIOS() ? 2000 : 500; // stagger on iOS
	}
}
