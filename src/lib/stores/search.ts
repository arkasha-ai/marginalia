import { writable } from 'svelte/store';
import type { SearchResults } from '$lib/modules/search-engine';

export const searchQuery = writable('');
export const searchResults = writable<SearchResults | null>(null);
export const searching = writable(false);
