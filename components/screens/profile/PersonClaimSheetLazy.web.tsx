import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the This is me sheet loads when a person page is first drawn (it stays mounted, closed, so it can animate), not with the page. */
export const PersonClaimSheet = lazyOnWeb(() => import('./PersonClaimSheet').then((m) => m.PersonClaimSheet));
