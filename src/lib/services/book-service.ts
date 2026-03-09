import { v4 as uuidv4 } from 'uuid';
import { getParser, getExtension } from '$lib/modules/book-parser';
import { insertBook, updateBook, deleteBook, getBooks, getBook, getIncompleteBooks, getBookFileData } from '$lib/db';
import { indexBook } from '$lib/modules/indexer';
import { indexingProgress } from '$lib/stores/indexing';
import type { Book } from '$lib/db/schema';

// In-memory file storage (for browser — no filesystem access)
const fileStore = new Map<string, ArrayBuffer>();

export function getFileData(filePath: string): ArrayBuffer | undefined {
	return fileStore.get(filePath);
}

/**
 * Get file data, falling back to DB if not in memory.
 * Also populates the in-memory store for subsequent reads.
 */
export function getFileDataWithFallback(bookId: string, filePath: string): ArrayBuffer | undefined {
	let data = fileStore.get(filePath);
	if (data) return data;

	// Fallback: load from DB
	const dbData = getBookFileData(bookId);
	if (dbData) {
		fileStore.set(filePath, dbData);
		return dbData;
	}
	return undefined;
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

	// Store file in memory
	fileStore.set(filePath, fileData);

	const title = metadata.title || file.name.replace(/\.[^.]+$/, '');

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

	// Start indexing in background
	setTimeout(() => {
		indexBook(bookId, fileData, (progress) => {
			indexingProgress.set(progress);
		}).then(() => {
			indexingProgress.set(null);
		}).catch((e) => {
			console.error(e);
			indexingProgress.set(null);
		});
	}, 100);

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
	for (const book of incomplete) {
		const fileData = getBookFileData(book.id);
		if (!fileData) {
			// No file data — reset to error
			updateBook(book.id, { indexingStatus: 'error' });
			continue;
		}
		// Store in memory for reader
		fileStore.set(book.filePath, fileData);
		// Restart indexing from last indexed page
		setTimeout(() => {
			indexBook(book.id, fileData, (progress) => {
				indexingProgress.set(progress);
			}).then(() => {
				indexingProgress.set(null);
			}).catch((e) => {
				console.error(e);
				indexingProgress.set(null);
			});
		}, 500);
	}
}
