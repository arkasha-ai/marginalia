import type { BookParser, BookMetadata, PageText } from './base';

interface Fb2Parsed {
	doc: Document;
	sections: Element[];
	paragraphs: Element[];
	totalPages: number;
}

const fb2Cache = new Map<string, Fb2Parsed>();

function parseFb2(fileData: ArrayBuffer, bookId?: string): Fb2Parsed {
	const key = bookId ?? 'default';
	if (fb2Cache.has(key)) return fb2Cache.get(key)!;

	const text = new TextDecoder('utf-8').decode(fileData);
	const doc = new DOMParser().parseFromString(text, 'text/xml');
	const body = doc.querySelector('body');
	const sections = body ? Array.from(body.querySelectorAll(':scope > section')) : [];
	const paragraphs = Array.from(doc.querySelectorAll('p'));
	const totalPages =
		sections.length > 0 ? sections.length : Math.max(1, Math.ceil(paragraphs.length / 20));

	const parsed: Fb2Parsed = { doc, sections, paragraphs, totalPages };
	if (bookId) fb2Cache.set(key, parsed);
	return parsed;
}

export class Fb2BookParser implements BookParser {
	canParse(extension: string): boolean {
		return extension === 'fb2';
	}

	async getMetadata(fileData: ArrayBuffer): Promise<BookMetadata> {
		const { doc, totalPages } = parseFb2(fileData);
		const titleInfo = doc.querySelector('title-info');
		const title = titleInfo?.querySelector('book-title')?.textContent ?? null;
		const firstName = titleInfo?.querySelector('author first-name')?.textContent ?? '';
		const lastName = titleInfo?.querySelector('author last-name')?.textContent ?? '';
		const author = [firstName, lastName].filter(Boolean).join(' ') || null;

		return { title, author, totalPages, format: 'fb2' };
	}

	async generateCover(fileData: ArrayBuffer): Promise<string> {
		const { doc } = parseFb2(fileData);

		try {
			const coverImage = doc.querySelector('coverpage image');
			if (coverImage) {
				// FB2 uses xlink:href or l:href — check multiple attributes
				const href =
					coverImage.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
					coverImage.getAttribute('xlink:href') ??
					coverImage.getAttribute('l:href') ??
					'';
				if (href.includes('#')) {
					const id = href.slice(href.indexOf('#') + 1);
					const binary = doc.querySelector(`binary[id="${id}"]`);
					if (binary?.textContent) {
						const contentType =
							binary.getAttribute('content-type') ?? 'image/jpeg';
						return `data:${contentType};base64,${binary.textContent.trim()}`;
					}
				}
			}
		} catch {
			// Cover extraction failed — fall through to placeholder
		}

		// Generate placeholder cover
		const meta = await this.getMetadata(fileData);
		const canvas = document.createElement('canvas');
		canvas.width = 200;
		canvas.height = 300;
		const ctx = canvas.getContext('2d')!;

		ctx.fillStyle = '#d0d8e0';
		ctx.fillRect(0, 0, 200, 300);

		ctx.fillStyle = '#333';
		ctx.font = 'bold 16px Outfit, sans-serif';
		const title = meta.title || 'FB2';
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

		if (meta.author) {
			ctx.fillStyle = '#666';
			ctx.font = '12px Outfit, sans-serif';
			ctx.fillText(meta.author, 15, y + 35);
		}

		return canvas.toDataURL('image/jpeg', 0.7);
	}

	async extractText(
		fileData: ArrayBuffer,
		pageNumber: number,
		bookId?: string
	): Promise<PageText> {
		const { sections, paragraphs } = parseFb2(fileData, bookId);
		const index = pageNumber - 1;

		let fullText = '';

		if (sections.length > 0) {
			if (index >= 0 && index < sections.length) {
				fullText = sections[index].textContent?.trim() ?? '';
			}
		} else {
			const start = index * 20;
			const end = start + 20;
			const slice = paragraphs.slice(start, end);
			fullText = slice.map((p) => p.textContent?.trim() ?? '').join('\n\n');
		}

		return { fullText, items: [] };
	}

	async renderPage(
		fileData: ArrayBuffer,
		pageNumber: number,
		canvas: HTMLCanvasElement,
		_scale?: number,
		bookId?: string
	): Promise<void> {
		const { fullText } = await this.extractText(fileData, pageNumber, bookId);

		const ctx = canvas.getContext('2d')!;
		const width = canvas.width || 400;
		const height = canvas.height || 600;

		// Clear canvas with paper background
		ctx.fillStyle = '#faf6f0';
		ctx.fillRect(0, 0, width, height);

		if (!fullText) {
			ctx.fillStyle = '#999';
			ctx.font = '16px Outfit, sans-serif';
			ctx.fillText('Страница не найдена', 20, 40);
			return;
		}

		ctx.fillStyle = '#333';
		ctx.font = '14px Outfit, sans-serif';
		const lineHeight = 22;
		const margin = 20;
		const maxWidth = width - margin * 2;
		let y = margin + lineHeight;

		const paragraphTexts = fullText.split(/\n+/);
		for (const para of paragraphTexts) {
			if (y > height - margin) break;

			const words = para.split(/\s+/);
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
			y += lineHeight * 0.3;
		}
	}
}
