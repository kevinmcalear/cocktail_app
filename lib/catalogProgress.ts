import { create } from 'zustand';

/** How many of the shared catalog's ranges have arrived while it downloads (null when it isn't), for the Reading screen's progress. */
export const useDownloading = create<{ ranges: number | null }>(() => ({ ranges: null }));
