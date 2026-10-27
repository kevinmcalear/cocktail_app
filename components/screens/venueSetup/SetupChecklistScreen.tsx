import { useRouter, type Href } from 'expo-router';

import { SetupChromeProvider } from '@/components/screens/onboarding/SetupPage';
import { WebHead } from '@/components/WebHead';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { SetupChecklist } from './SetupChecklist';

/**
 * "Set up <bar>" as a page: from the top of Library on a phone, the first
 * row of the sidebar on a desktop, and Venue settings. Back goes where it
 * came from.
 */
export function SetupChecklistScreen({ barId }: { barId: string }) {
  const router = useRouter();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const name = venue?.name ?? 'your bar';
  const wide = useIsWideWeb();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href));
  // Wide web has no Back: the sidebar is the way around (owner-setup step 5).
  return (
    <SetupChromeProvider value={{ title: '', onBack: wide ? undefined : back }}>
      <WebHead>
        <title>{`Set up ${name}`}</title>
      </WebHead>
      <SetupChecklist barId={barId} name={name} />
    </SetupChromeProvider>
  );
}
