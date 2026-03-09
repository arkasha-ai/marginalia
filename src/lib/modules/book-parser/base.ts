export interface PageText {
	fullText: string;
	items: TextItem[];
}

export interface TextItem {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BookMetadata {
	title: string | null;
	author: string | null;
	totalPages: number;
	format: 'pdf' | 'epub' | 'fb2';
}

export interface BookParser {
	canParse(extension: string): boolean;
	getMetadata(fileData: ArrayBuffer): Promise<BookMetadata>;
	extractText(fileData: ArrayBuffer, pageNumber: number, bookId?: string): Promise<PageText>;
	renderPage(fileData: ArrayBuffer, pageNumber: number, canvas: HTMLCanvasElement, scale?: number, bookId?: string): Promise<void>;
	generateCover(fileData: ArrayBuffer, maxWidth?: number): Promise<string>;
}
