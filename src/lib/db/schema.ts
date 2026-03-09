// Database schema — pure TypeScript types (no Drizzle ORM runtime, using raw SQLite)

export interface Book {
	id: string;
	title: string;
	filePath: string;
	fileData?: Uint8Array | null;
	format: 'pdf' | 'epub' | 'fb2';
	coverDataUrl: string | null;
	totalPages: number;
	lastReadPage: number;
	indexingStatus: 'pending' | 'in_progress' | 'completed' | 'error';
	indexingProgress: number;
	fileSizeBytes: number | null;
	lastOpenedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Chunk {
	id: string;
	bookId: string;
	pageNumber: number;
	chunkIndex: number;
	text: string;
	embedding: Float32Array | null;
	charOffsetStart: number | null;
	charOffsetEnd: number | null;
	createdAt: string;
}

export interface Highlight {
	id: string;
	bookId: string;
	pageNumber: number;
	text: string;
	startOffset: number;
	endOffset: number;
	color: string;
	note: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface HighlightWithBook extends Highlight {
	bookTitle: string;
}

export interface AppSetting {
	key: string;
	value: string;
}

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS books (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	file_path TEXT NOT NULL UNIQUE,
	file_data BLOB,
	format TEXT NOT NULL,
	cover_data_url TEXT,
	total_pages INTEGER NOT NULL,
	last_read_page INTEGER NOT NULL DEFAULT 1,
	indexing_status TEXT NOT NULL DEFAULT 'pending',
	indexing_progress REAL DEFAULT 0,
	file_size_bytes INTEGER,
	last_opened_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
	id TEXT PRIMARY KEY,
	book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	page_number INTEGER NOT NULL,
	chunk_index INTEGER NOT NULL,
	text TEXT NOT NULL,
	embedding BLOB,
	char_offset_start INTEGER,
	char_offset_end INTEGER,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_book_id ON chunks(book_id);
CREATE INDEX IF NOT EXISTS idx_chunks_book_page ON chunks(book_id, page_number);

CREATE TABLE IF NOT EXISTS highlights (
	id TEXT PRIMARY KEY,
	book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	page_number INTEGER NOT NULL,
	text TEXT NOT NULL,
	start_offset INTEGER NOT NULL,
	end_offset INTEGER NOT NULL,
	color TEXT NOT NULL DEFAULT 'yellow',
	note TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_highlights_book_id ON highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_book_page ON highlights(book_id, page_number);

CREATE TABLE IF NOT EXISTS app_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('db_version', '1');
`;
