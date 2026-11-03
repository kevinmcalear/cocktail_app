import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the claim flow (its methods, status and checks) loads when someone taps Claim, not with every bar page. */
export const ClaimDialog = lazyOnWeb(() => import('./ClaimDialog').then((m) => m.ClaimDialog));
