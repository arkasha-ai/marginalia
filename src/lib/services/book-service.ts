import { v4 as uuidv4 } from 'uuid';
import { getParser, getExtension } from '$lib/modules/book-parser';
import { insertBook, updateBook, deleteBook, getBooks, getBook } from '$lib/db';
import { indexBook } from '$lib/modules/indexer';
import type { Book } from '$lib/db/schema';

// In-memory file storage (for browser — no filesystem access)
const fileStore = new Map<string, ArrayBuffer>();

export function getFileData(filePath: string): ArrayBuffer | undefined {
	return fileStore.get(filePath);
}

export async function addBook(file: File): Promise<Book> {
	const fileData = await file.arrayBuffer();
	const ext = getExtension(file.name);
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
			// Progress callback — stores will be updated by polling
		}).catch(console.error);
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
