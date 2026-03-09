import type { BookParser, BookMetadata, PageText } from './base';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Use CDN worker matching the installed version — no version mismatch
if (typeof window !== 'undefined') {
	pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

// Cache parsed PDF documents by bookId to avoid re-parsing on every page turn
const pdfDocCache = new Map<string, PDFDocumentProxy>();

export class PdfBookParser implements BookParser {
	canParse(extension: string): boolean {
		return extension === 'pdf';
	}

	private async getDoc(fileData: ArrayBuffer, cacheKey?: string): Promise<PDFDocumentProxy> {
		if (cacheKey) {
			const cached = pdfDocCache.get(cacheKey);
			if (cached) return cached;
		}
		const doc = await pdfjsLib.getDocument({ data: fileData.slice(0) }).promise;
		if (cacheKey) {
			pdfDocCache.set(cacheKey, doc);
		}
		return doc;
	}

	static clearCache(bookId: string): void {
		const doc = pdfDocCache.get(bookId);
		if (doc) {
			doc.destroy();
			pdfDocCache.delete(bookId);
		}
	}

	async getMetadata(fileData: ArrayBuffer): Promise<BookMetadata> {
		const doc = await this.getDoc(fileData);
		const meta = await doc.getMetadata();
		const rawTitle = (meta?.info as any)?.Title;
		const title = rawTitle && rawTitle !== 'untitled' ? rawTitle : null;
		const author = (meta?.info as any)?.Author || null;
		return {
			title,
			author,
			totalPages: doc.numPages,
			format: 'pdf'
		};
	}

	async extractText(fileData: ArrayBuffer, pageNumber: number, bookId?: string): Promise<PageText> {
		const doc = await this.getDoc(fileData, bookId);
		const page = await doc.getPage(pageNumber);
		const textContent = await page.getTextContent();
		const viewport = page.getViewport({ scale: 1.0 });

		const items = textContent.items
			.filter((item: any) => 'str' in item && item.str.trim())
			.map((item: any) => ({
				text: item.str,
				x: item.transform[4],
				y: viewport.height - item.transform[5],
				width: item.width,
				height: item.height
			}));

		const fullText = textContent.items
			.filter((item: any) => 'str' in item)
			.map((item: any) => item.str)
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();

		return { fullText, items };
	}

	async renderPage(fileData: ArrayBuffer, pageNumber: number, canvas: HTMLCanvasElement, scale = 1.5, bookId?: string): Promise<void> {
		const doc = await this.getDoc(fileData, bookId);
		const page = await doc.getPage(pageNumber);
		const viewport = page.getViewport({ scale });
		canvas.width = viewport.width;
		canvas.height = viewport.height;
		const ctx = canvas.getContext('2d')!;
		await page.render({ canvasContext: ctx, viewport }).promise;
	}

	async generateCover(fileData: ArrayBuffer, maxWidth = 300): Promise<string> {
		const doc = await this.getDoc(fileData);
		const page = await doc.getPage(1);
		const viewport = page.getViewport({ scale: 1.0 });
		const scale = maxWidth / viewport.width;
		const scaledViewport = page.getViewport({ scale });

		const canvas = document.createElement('canvas');
		canvas.width = scaledViewport.width;
		canvas.height = scaledViewport.height;
		const ctx = canvas.getContext('2d')!;
		await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
		return canvas.toDataURL('image/jpeg', 0.7);
	}
}
