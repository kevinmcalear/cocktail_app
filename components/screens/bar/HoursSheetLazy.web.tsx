import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the week of hours loads after the bar page, not with it. */
export const HoursSheet = lazyOnWeb(() => import('./HoursSheet').then((m) => m.HoursSheet));
