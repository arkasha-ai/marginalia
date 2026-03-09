import type { BookParser, BookMetadata, PageText } from './base';
import ePub from 'epubjs';
import type Book from 'epubjs/types/book';

// Cache parsed EPUB Book objects by bookId to avoid re-parsing on every page turn
const epubBookCache = new Map<string, Book>();

export class EpubBookParser implements BookParser {
	canParse(extension: string): boolean {
		return extension === 'epub';
	}

	private async getBook(fileData: ArrayBuffer, cacheKey?: string): Promise<Book> {
		if (cacheKey) {
			const cached = epubBookCache.get(cacheKey);
			if (cached) return cached;
		}
		const book = ePub(fileData);
		await book.ready;
		if (cacheKey) {
			epubBookCache.set(cacheKey, book);
		}
		return book;
	}

	static clearCache(bookId: string): void {
		const book = epubBookCache.get(bookId);
		if (book) {
			book.destroy();
			epubBookCache.delete(bookId);
		}
	}

	async getMetadata(fileData: ArrayBuffer): Promise<BookMetadata> {
		const book = await this.getBook(fileData);
		const meta = book.packaging.metadata;
		return {
			title: meta.title || null,
			author: meta.creator || null,
			totalPages: (book.spine as any).spineItems?.length ?? (book.spine as any).length ?? 1,
			format: 'epub'
		};
	}

	async generateCover(fileData: ArrayBuffer): Promise<string> {
		const book = await this.getBook(fileData);

		try {
			const coverUrl = await book.coverUrl();
			if (coverUrl) {
				// coverUrl() returns a blob URL in browser — fetch and convert to data URL
				const response = await fetch(coverUrl);
				const blob = await response.blob();
				return await new Promise<string>((resolve) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result as string);
					reader.readAsDataURL(blob);
				});
			}
		} catch {
			// Cover extraction failed — fall through to placeholder
		}

		// Generate placeholder cover
		const canvas = document.createElement('canvas');
		canvas.width = 200;
		canvas.height = 300;
		const ctx = canvas.getContext('2d')!;

		// Background
		ctx.fillStyle = '#e8ddd0';
		ctx.fillRect(0, 0, 200, 300);

		// Title text
		const meta = book.packaging.metadata;
		ctx.fillStyle = '#333';
		ctx.font = 'bold 16px Outfit, sans-serif';
		const title = meta.title || 'EPUB';
		// Simple word wrap
		const words = title.split(' ');
		let line = '';
		let y = 120;
		for (const word of words) {
			const test = line ? `${line} ${word}` : word;
			if (ctx.measureText(test).width > 170) {
				ctx.fillText(line, 15, y);
				line = word;
				y += 22;
			} else {
				line = test;
			}
		}
		if (line) ctx.fillText(line, 15, y);

		// Author
		if (meta.creator) {
			ctx.fillStyle = '#666';
			ctx.font = '12px Outfit, sans-serif';
			ctx.fillText(meta.creator, 15, y + 35);
		}

		return canvas.toDataURL('image/jpeg', 0.7);
	}

	async extractText(fileData: ArrayBuffer, pageNumber: number, bookId?: string): Promise<PageText> {
		const book = await this.getBook(fileData, bookId);
		const spineItems = (book.spine as any).spineItems ?? (book.spine as any).items ?? [];
		const index = pageNumber - 1;
		if (index < 0 || index >= spineItems.length) return { fullText: '', items: [] };

		const fullText = await this.loadSpineText(book, index);
		return { fullText, items: [] };
	}

	async renderPage(
		fileData: ArrayBuffer,
		pageNumber: number,
		canvas: HTMLCanvasElement,
		_scale?: number,
		bookId?: string
	): Promise<void> {
		const book = await this.getBook(fileData, bookId);
		const spineItems = (book.spine as any).spineItems ?? (book.spine as any).items ?? [];

		// Set canvas dimensions explicitly (unlike PDF, epub has no viewport)
		const container = canvas.parentElement;
		const width = container?.clientWidth || canvas.offsetWidth || 600;
		const height = Math.round(width * 1.41); // A4 ratio
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext('2d')!;

		// Paper background
		ctx.fillStyle = '#faf6f0';
		ctx.fillRect(0, 0, width, height);

		if (!spineItems.length) {
			this.drawError(ctx, width, 'Не удалось загрузить EPUB');
			return;
		}

		const index = pageNumber - 1;
		if (index < 0 || index >= spineItems.length) {
			this.drawError(ctx, width, 'Страница не найдена');
			return;
		}

		try {
			const text = await this.loadSpineText(book, index);

			if (!text) {
				this.drawError(ctx, width, 'Глава пуста');
				return;
			}

			this.drawText(ctx, text, width, height);
		} catch (e) {
			console.error('EPUB render error:', e);
			this.drawError(ctx, width, 'Ошибка загрузки главы');
		}
	}

	private async loadSpineText(book: any, index: number): Promise<string> {
		try {
			// Method 1: section.load()
			const section = book.spine.get(index);
			if (section) {
				const doc = await section.load(book.load.bind(book));
				const body = (doc as any)?.body ?? (doc as any)?.documentElement;
				const text = body?.textContent?.replace(/\s+/g, ' ').trim();
				if (text) return text;
			}
		} catch { /* fall through */ }

		try {
			// Method 2: book.resources / direct URL load
			const spineItems = (book.spine as any).spineItems ?? (book.spine as any).items ?? [];
			const item = spineItems[index];
			if (item?.href) {
				const contents = await book.load(item.href);
				if (typeof contents === 'string') {
					const parser = new DOMParser();
					const doc = parser.parseFromString(contents, 'text/html');
					return doc.body?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
				}
				if (contents?.body) {
					return (contents as Document).body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
				}
			}
		} catch { /* fall through */ }

		return '';
	}

	private drawText(ctx: CanvasRenderingContext2D, text: string, width: number, height: number): void {
		ctx.fillStyle = '#2c2c2c';
		ctx.font = '16px Georgia, serif';
		const lineHeight = 26;
		const margin = 28;
		const maxWidth = width - margin * 2;
		let y = margin + lineHeight;

		const paragraphs = text.split(/\n+/);
		for (const para of paragraphs) {
			if (y > height - margin) break;
			const trimmed = para.trim();
			if (!trimmed) { y += lineHeight * 0.5; continue; }

			const words = trimmed.split(/\s+/);
			let line = '';
			for (const word of words) {
				if (y > height - margin) break;
				const testLine = line ? `${line} ${word}` : word;
				if (ctx.measureText(testLine).width > maxWidth && line) {
					ctx.fillText(line, margin, y);
					line = word;
					y += lineHeight;
				} else {
					line = testLine;
				}
			}
			if (line && y <= height - margin) {
				ctx.fillText(line, margin, y);
				y += lineHeight;
			}
			y += lineHeight * 0.4;
		}
	}

	private drawError(ctx: CanvasRenderingContext2D, width: number, message: string): void {
		ctx.fillStyle = '#999';
		ctx.font = '15px Outfit, sans-serif';
		ctx.fillText(message, 20, 40);
	}
}
