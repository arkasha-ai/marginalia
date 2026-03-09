import { writable } from 'svelte/store';

export const currentPage = writable(1);
export const totalPages = writable(1);
export const toolbarVisible = writable(false);
export const isRendering = writable(false);
