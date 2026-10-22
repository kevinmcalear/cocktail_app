import { useRouter, type Href } from 'expo-router';

import { SetupChromeProvider } from '@/components/screens/onboarding/SetupPage';
import { WebHead } from '@/components/WebHead';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useAppMode } from '@/store/useAppMode';

import { DoneMark } from './DoneStep';
import { WhatNext } from './WhatNext';

/** Venue settings' What next: the steps from the end of setup, there whenever the bar wants them. */
export function WhatNextScreen({ barId }: { barId: string }) {
  const router = useRouter();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const enterVenue = useAppMode((s) => s.enterVenue);
  const name = venue?.name ?? 'your bar';
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href));
  return (
    <SetupChromeProvider value={{ title: '', eyebrow: venue?.name ?? null, eyebrowTone: 'accent', mark: venue ? <DoneMark venue={venue} /> : undefined, onBack: back }}>
      <WebHead>
        <title>What next</title>
      </WebHead>
      <WhatNext
        barId={barId}
        name={name}
        openLabel={`Open ${name}`}
        onOpen={() => {
          enterVenue(barId);
          router.replace('/(tabs)' as Href);
        }}
      />
    </SetupChromeProvider>
  );
}
