import { AppTabs } from '@/components/nav/AppTabs';

/**
 * The tabs: native tabs on iOS and Android (AppTabs.tsx), and the glass tab
 * bar on phone-width web with the side nav on wide web (AppTabs.web.tsx).
 */
export default function TabLayout() {
  return <AppTabs />;
}
