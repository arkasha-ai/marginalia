import type { BookParser, BookMetadata, PageText } from './base';

export class EpubBookParser implements BookParser {
	canParse(extension: string): boolean {
		return extension === 'epub';
	}

	async getMetadata(_fileData: ArrayBuffer): Promise<BookMetadata> {
		// Stub — EPUB support is out of MVP scope
		return { title: 'EPUB Book', author: null, totalPages: 1, format: 'epub' };
	}

	async extractText(_fileData: ArrayBuffer, _pageNumber: number): Promise<PageText> {
		return { fullText: 'EPUB parsing not yet implemented', items: [] };
	}

	async renderPage(_fileData: ArrayBuffer, _pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
		const ctx = canvas.getContext('2d')!;
		canvas.width = 400;
		canvas.height = 600;
		ctx.fillStyle = '#faf6f0';
		ctx.fillRect(0, 0, 400, 600);
		ctx.fillStyle = '#333';
		ctx.font = '16px Outfit';
		ctx.fillText('EPUB format — coming soon', 60, 300);
	}

	async generateCover(_fileData: ArrayBuffer): Promise<string> {
		const canvas = document.createElement('canvas');
		canvas.width = 200;
		canvas.height = 300;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#e8ddd0';
		ctx.fillRect(0, 0, 200, 300);
		ctx.fillStyle = '#666';
		ctx.font = '14px Outfit';
		ctx.fillText('EPUB', 80, 150);
		return canvas.toDataURL('image/jpeg', 0.7);
	}
}
