import { lazyOnWeb } from '@/components/lazyOnWeb';

/** On the web the alerts sheet loads when Love asks what to send, not with the page. */
export const LoveAlertsSheet = lazyOnWeb(() => import('./LoveAlertsSheet').then((m) => m.LoveAlertsSheet));
