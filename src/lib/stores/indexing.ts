import { writable } from 'svelte/store';
import type { IndexProgress } from '$lib/modules/indexer';

export const indexingProgress = writable<IndexProgress | null>(null);
