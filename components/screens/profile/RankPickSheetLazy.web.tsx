import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the rank-a-drink picker loads after the bar page, not with it (it stays mounted, closed, so it can animate). */
export const RankPickSheet = lazyOnWeb(() => import('./RankPickSheet').then((m) => m.RankPickSheet));
