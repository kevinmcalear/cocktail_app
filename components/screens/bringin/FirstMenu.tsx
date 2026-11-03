import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';

import { SetupChromeProvider } from '@/components/screens/onboarding/SetupPage';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { MenuStep } from '@/components/screens/venueSetup/MenuStep';
import type { MatchData } from '@/lib/bringInMatch';
import type { BringInJob } from '@/store/useBringIn';

import { BringInChooser } from './BringInChooser';
import { MenuCamera } from './MenuCamera';

/**
 * The owner's first menu, from "Set up <bar>" (`step` is its "Set up Little
 * Rye · Tonight's menu" line): straight into the camera (MenuCamera), with
 * Paste and Type a tap away. Paste is Bring in's own; Type is starting the
 * menu yourself, or from the classics (MenuStep).
 */
export function FirstMenu({ step, barId, job, data, onClose, onReady }: { step: string; barId: string | null; job: BringInJob | null; data: MatchData | null; onClose: () => void; onReady: () => void }) {
  const router = useRouter();
  const [way, setWay] = useState<'camera' | 'paste' | 'type'>('camera');
  const camera = () => setWay('camera');

  if (!job && way === 'paste') {
    return (
      <SafetyPage title="Tonight’s menu" intro="Paste the menu, or a link to it. We read it, you check it." topLabel={step} onBack={camera}>
        <BringInChooser menu paste />
      </SafetyPage>
    );
  }
  if (!job && way === 'type' && barId) {
    return (
      <SetupChromeProvider value={{ title: 'Tonight’s menu', onBack: camera }}>
        <MenuStep barId={barId} step={step} onBack={camera} onDone={onClose} onSkip={onClose} onBringIn={camera} onMade={(id) => router.replace(`/menus/${id}/edit` as Href)} />
      </SetupChromeProvider>
    );
  }
  return <MenuCamera barId={barId} job={job} data={data} onClose={onClose} onReady={onReady} onPaste={() => setWay('paste')} onType={() => setWay('type')} />;
}
