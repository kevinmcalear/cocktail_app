import { useState } from 'react';

import { Button, Segmented } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { KitInline, type KitKind } from '@/components/screens/kit/KitPage';
import { KitIceScreen } from '@/components/screens/venue/KitIceScreen';
import { KitToolsScreen } from '@/components/screens/venue/KitToolsScreen';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { GlassesStep } from './GlassesStep';

const TABS: { value: KitKind; label: string }[] = [
  { value: 'glassware', label: 'Glassware' },
  { value: 'ice', label: 'Ice' },
  { value: 'tools', label: 'Tools' },
];

/**
 * The checklist's Kit row (owner-setup steps 6 and 7, call 8): one place with
 * three tabs. Glassware asks for kinds first; Ice and Tools are Kit's own
 * lists and Add sheets (Kit and ice), here under setup's title. Done, from
 * any tab, goes back to the checklist.
 */
export function KitStep({ barId, pageId, name, step, onBack, onDone }: { barId: string; pageId: string | null; name: string; step: string; onBack: () => void; onDone: () => void }) {
  const chrome = useSetupChrome();
  const wide = useIsWideWeb();
  const [tab, setTab] = useState<KitKind>('glassware');
  // A phone names the tab; a wide screen names the place, as the board draws them.
  const title = wide ? 'Kit' : TABS.find((t) => t.value === tab)!.label;
  const intro = wide ? `What ${name} pours into, the ice it pours and the tools behind the bar.` : undefined;
  return (
    <SetupChromeProvider value={{ ...chrome, title, intro, mark: undefined, eyebrow: null, progress: null, topLabel: step, noBack: false, onBack }}>
      <SetupPage footer={<Button label="Done, back to setup" size="lg" onPress={onDone} />}>
        <Segmented options={TABS} value={tab} onChange={setTab} accessibilityLabel="Kit" variant="pill" stretch />
        {tab === 'glassware' ? (
          <GlassesStep barId={barId} pageId={pageId} name={name} />
        ) : (
          <KitInline.Provider value>{tab === 'ice' ? <KitIceScreen barId={barId} /> : <KitToolsScreen barId={barId} />}</KitInline.Provider>
        )}
      </SetupPage>
    </SetupChromeProvider>
  );
}
