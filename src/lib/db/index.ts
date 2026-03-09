import { CREATE_TABLES_SQL, type Book, type Chunk, type Highlight, type HighlightWithBook } from './schema';

let db: any = null;

export async function initDb(): Promise<void> {
	if (db) return;
	
	// Load sql.js via CDN script tag for reliable browser compatibility
	await new Promise<void>((resolve, reject) => {
		if ((window as any).initSqlJs) { resolve(); return; }
		const script = document.createElement('script');
		script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js';
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('Failed to load sql.js'));
		document.head.appendChild(script);
	});

	const initSqlJs = (window as any).initSqlJs;
	const SQL = await initSqlJs({
		locateFile: () => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm'
	});
	
	db = new SQL.Database();
	db.run(CREATE_TABLES_SQL);
}

export function getDb() {
	if (!db) throw new Error('Database not initialized. Call initDb() first.');
	return db;
}

// --- Books ---

export function getBooks(): Book[] {
	const results = db.exec('SELECT * FROM books ORDER BY last_opened_at DESC NULLS LAST, created_at DESC');
	if (!results.length) return [];
	return results[0].values.map((row: any[]) => rowToBook(results[0].columns, row));
}

export function getBook(id: string): Book | null {
	const stmt = db.prepare('SELECT * FROM books WHERE id = ?');
	stmt.bind([id]);
	if (stmt.step()) {
		const row = stmt.getAsObject();
		stmt.free();
		return objToBook(row);
	}
	stmt.free();
	return null;
}

export function insertBook(book: Omit<Book, 'createdAt' | 'updatedAt'>): Book {
	const now = new Date().toISOString();
	db.run(
		`INSERT INTO books (id, title, file_path, format, cover_data_url, total_pages, last_read_page, indexing_status, indexing_progress, file_size_bytes, last_opened_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[book.id, book.title, book.filePath, book.format, book.coverDataUrl, book.totalPages, book.lastReadPage, book.indexingStatus, book.indexingProgress, book.fileSizeBytes, book.lastOpenedAt, now, now]
	);
	return { ...book, createdAt: now, updatedAt: now } as Book;
}

export function updateBook(id: string, data: Partial<Book>): void {
	const fields: string[] = [];
	const values: any[] = [];

	const fieldMap: Record<string, string> = {
		title: 'title', filePath: 'file_path', format: 'format',
		coverDataUrl: 'cover_data_url', totalPages: 'total_pages',
		lastReadPage: 'last_read_page', indexingStatus: 'indexing_status',
		indexingProgress: 'indexing_progress', fileSizeBytes: 'file_size_bytes',
		lastOpenedAt: 'last_opened_at'
	};

	for (const [key, col] of Object.entries(fieldMap)) {
		if (key in data) {
			fields.push(`${col} = ?`);
			values.push((data as any)[key]);
		}
	}

	if (fields.length === 0) return;
	fields.push('updated_at = ?');
	values.push(new Date().toISOString());
	values.push(id);

	db.run(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteBook(id: string): void {
	db.run('DELETE FROM books WHERE id = ?', [id]);
}

// --- Chunks ---

export function insertChunks(chunks: Array<Omit<Chunk, 'createdAt'>>): void {
	const now = new Date().toISOString();
	for (const c of chunks) {
		const embBlob = c.embedding ? new Uint8Array(c.embedding.buffer) : null;
		db.run(
			`INSERT INTO chunks (id, book_id, page_number, chunk_index, text, embedding, char_offset_start, char_offset_end, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[c.id, c.bookId, c.pageNumber, c.chunkIndex, c.text, embBlob, c.charOffsetStart, c.charOffsetEnd, now]
		);
	}
}

export function getAllChunksWithEmbeddings(): Array<{ id: string; bookId: string; bookTitle: string; pageNumber: number; text: string; embedding: Float32Array }> {
	const stmt = db.prepare(
		`SELECT c.id, c.book_id, b.title as book_title, c.page_number, c.text, c.embedding
		 FROM chunks c JOIN books b ON c.book_id = b.id
		 WHERE c.embedding IS NOT NULL`
	);
	const results: any[] = [];
	while (stmt.step()) {
		const row = stmt.getAsObject();
		if (row.embedding) {
			results.push({
				id: row.id,
				bookId: row.book_id,
				bookTitle: row.book_title,
				pageNumber: row.page_number,
				text: row.text,
				embedding: new Float32Array(new Uint8Array(row.embedding).buffer)
			});
		}
	}
	stmt.free();
	return results;
}

export function deleteChunksByBook(bookId: string): void {
	db.run('DELETE FROM chunks WHERE book_id = ?', [bookId]);
}

export function getLastIndexedPage(bookId: string): number {
	const stmt = db.prepare('SELECT MAX(page_number) as last_page FROM chunks WHERE book_id = ?');
	stmt.bind([bookId]);
	if (stmt.step()) {
		const row = stmt.getAsObject();
		stmt.free();
		return (row.last_page as number) || 0;
	}
	stmt.free();
	return 0;
}

// --- Highlights ---

export function getHighlights(bookId?: string): HighlightWithBook[] {
	let sql = `SELECT h.*, b.title as book_title FROM highlights h JOIN books b ON h.book_id = b.id`;
	const params: any[] = [];
	if (bookId) {
		sql += ' WHERE h.book_id = ?';
		params.push(bookId);
	}
	sql += ' ORDER BY h.created_at DESC';

	const stmt = db.prepare(sql);
	if (params.length) stmt.bind(params);
	const highlights: HighlightWithBook[] = [];
	while (stmt.step()) {
		highlights.push(objToHighlightWithBook(stmt.getAsObject()));
	}
	stmt.free();
	return highlights;
}

export function getHighlightsByPage(bookId: string, pageNumber: number): Highlight[] {
	const stmt = db.prepare('SELECT * FROM highlights WHERE book_id = ? AND page_number = ? ORDER BY start_offset');
	stmt.bind([bookId, pageNumber]);
	const highlights: Highlight[] = [];
	while (stmt.step()) {
		highlights.push(objToHighlight(stmt.getAsObject()));
	}
	stmt.free();
	return highlights;
}

export function insertHighlight(h: Omit<Highlight, 'createdAt' | 'updatedAt'>): Highlight {
	const now = new Date().toISOString();
	db.run(
		`INSERT INTO highlights (id, book_id, page_number, text, start_offset, end_offset, color, note, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[h.id, h.bookId, h.pageNumber, h.text, h.startOffset, h.endOffset, h.color, h.note, now, now]
	);
	return { ...h, createdAt: now, updatedAt: now };
}

export function updateHighlight(id: string, data: { note?: string | null }): void {
	if ('note' in data) {
		db.run('UPDATE highlights SET note = ?, updated_at = ? WHERE id = ?', [data.note, new Date().toISOString(), id]);
	}
}

export function deleteHighlight(id: string): void {
	db.run('DELETE FROM highlights WHERE id = ?', [id]);
}

// --- Helpers ---

function rowToBook(columns: string[], values: any[]): Book {
	const obj: any = {};
	columns.forEach((col, i) => obj[col] = values[i]);
	return objToBook(obj);
}

function objToBook(row: any): Book {
	return {
		id: row.id,
		title: row.title,
		filePath: row.file_path,
		format: row.format,
		coverDataUrl: row.cover_data_url,
		totalPages: row.total_pages,
		lastReadPage: row.last_read_page,
		indexingStatus: row.indexing_status,
		indexingProgress: row.indexing_progress ?? 0,
		fileSizeBytes: row.file_size_bytes,
		lastOpenedAt: row.last_opened_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function objToHighlight(row: any): Highlight {
	return {
		id: row.id,
		bookId: row.book_id,
		pageNumber: row.page_number,
		text: row.text,
		startOffset: row.start_offset,
		endOffset: row.end_offset,
		color: row.color,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function objToHighlightWithBook(row: any): HighlightWithBook {
	return {
		...objToHighlight(row),
		bookTitle: row.book_title
	};
}
