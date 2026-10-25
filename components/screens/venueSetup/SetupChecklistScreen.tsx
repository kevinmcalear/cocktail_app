import { useRouter, type Href } from 'expo-router';

import { SetupChromeProvider } from '@/components/screens/onboarding/SetupPage';
import { WebHead } from '@/components/WebHead';
import { useActiveVenue } from '@/hooks/useActiveVenue';

import { DoneMark } from './DoneStep';
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
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href));
  return (
    <SetupChromeProvider value={{ title: '', eyebrow: venue?.name ?? null, eyebrowTone: 'accent', mark: venue ? <DoneMark venue={venue} /> : undefined, onBack: back }}>
      <WebHead>
        <title>{`Set up ${name}`}</title>
      </WebHead>
      <SetupChecklist barId={barId} name={name} />
    </SetupChromeProvider>
  );
}
