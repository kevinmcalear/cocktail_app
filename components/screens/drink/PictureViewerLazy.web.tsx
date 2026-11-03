import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the full-screen picture viewer loads after the drink, not with it (it stays mounted, closed, so it can animate). */
export const PictureViewer = lazyOnWeb(() => import('./PictureViewer').then((m) => m.PictureViewer));
