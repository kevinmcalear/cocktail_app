import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the swap sheet loads when Swap is tapped, not with Drinks. */
export const SwapSheet = lazyOnWeb(() => import('./SwapSheet').then((m) => m.SwapSheet));
