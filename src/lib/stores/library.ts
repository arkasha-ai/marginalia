import { writable } from 'svelte/store';
import type { Book } from '$lib/db/schema';

export const books = writable<Book[]>([]);
export const loading = writable(true);
export const dbReady = writable(false);
