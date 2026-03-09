import type { BookParser } from './base';
import { PdfBookParser } from './pdf';
import { EpubBookParser } from './epub';
import { Fb2BookParser } from './fb2';

const parsers: BookParser[] = [
	new PdfBookParser(),
	new EpubBookParser(),
	new Fb2BookParser()
];

export function getParser(fileName: string): BookParser {
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
	const parser = parsers.find(p => p.canParse(ext));
	if (!parser) throw new Error(`Формат .${ext} не поддерживается`);
	return parser;
}

export function getExtension(fileName: string): string {
	return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export type { BookParser, BookMetadata, PageText, TextItem } from './base';
