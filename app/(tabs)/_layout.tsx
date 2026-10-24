import { AppTabs } from '@/components/nav/AppTabs';

/**
 * The tabs: native tabs on iPhone and Android (AppTabs.tsx), and the JS tabs
 * (JsTabs.tsx) on the web and a wide iPad: the glass tab bar on phone-width
 * web, the side nav on wide screens.
 */
export default function TabLayout() {
  return <AppTabs />;
}
