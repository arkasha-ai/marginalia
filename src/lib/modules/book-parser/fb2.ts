import type { BookParser, BookMetadata, PageText } from './base';

export class Fb2BookParser implements BookParser {
	canParse(extension: string): boolean {
		return extension === 'fb2';
	}

	async getMetadata(_fileData: ArrayBuffer): Promise<BookMetadata> {
		return { title: 'FB2 Book', author: null, totalPages: 1, format: 'fb2' };
	}

	async extractText(_fileData: ArrayBuffer, _pageNumber: number): Promise<PageText> {
		return { fullText: 'FB2 parsing not yet implemented', items: [] };
	}

	async renderPage(_fileData: ArrayBuffer, _pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
		const ctx = canvas.getContext('2d')!;
		canvas.width = 400;
		canvas.height = 600;
		ctx.fillStyle = '#faf6f0';
		ctx.fillRect(0, 0, 400, 600);
		ctx.fillStyle = '#333';
		ctx.font = '16px Outfit';
		ctx.fillText('FB2 format — coming soon', 65, 300);
	}

	async generateCover(_fileData: ArrayBuffer): Promise<string> {
		const canvas = document.createElement('canvas');
		canvas.width = 200;
		canvas.height = 300;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#d0d8e0';
		ctx.fillRect(0, 0, 200, 300);
		ctx.fillStyle = '#666';
		ctx.font = '14px Outfit';
		ctx.fillText('FB2', 85, 150);
		return canvas.toDataURL('image/jpeg', 0.7);
	}
}
