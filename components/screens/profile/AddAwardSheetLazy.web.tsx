import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the add-award sheet loads after the page, not with it (it stays mounted, closed, so it can animate). */
export const AddAwardSheet = lazyOnWeb(() => import('./AddAwardSheet').then((m) => m.AddAwardSheet));
