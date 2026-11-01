import { useState } from 'react';

import { Button, Caption, Segmented } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import type { KitKind } from '@/components/screens/kit/KitPage';
import { KitIceScreen } from '@/components/screens/venue/KitIceScreen';
import { KitToolsScreen } from '@/components/screens/venue/KitToolsScreen';
import { SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { SubPageInline } from '@/components/screens/venue/VenueSubPage';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useSetVenueFeature } from '@/hooks/useVenueFeatures';
import { VENUE_FEATURES } from '@/lib/venueFeatures';

import { GlassesStep } from './GlassesStep';

const TABS: { value: KitKind; label: string }[] = [
  { value: 'glassware', label: 'Glassware' },
  { value: 'ice', label: 'Ice' },
  { value: 'tools', label: 'Tools' },
];

const ADVANCED = VENUE_FEATURES.find((f) => f.key === 'advanced')!;

/**
 * The checklist's Kit row (owner-setup steps 6 and 7, call 8). Simple by
 * default (jam dec-24): the glasses, and under them a switch for Advanced
 * options. With it on, three tabs: Glassware asks for kinds first; Ice and
 * Tools are Kit's own lists and Add sheets (Kit and ice), here under setup's
 * title. Done, from any tab, goes back to the checklist.
 */
export function KitStep({ barId, pageId, name, step, onBack, onDone }: { barId: string; pageId: string | null; name: string; step: string; onBack: () => void; onDone: () => void }) {
  const chrome = useSetupChrome();
  const wide = useIsWideWeb();
  const { features, set, error } = useSetVenueFeature(barId);
  const advanced = features.includes('advanced');
  const [picked, setTab] = useState<KitKind>('glassware');
  const tab = advanced ? picked : 'glassware';
  // A phone names the tab; a wide screen names the place, as the board draws them.
  const title = !advanced ? 'Glassware' : wide ? 'Kit' : TABS.find((t) => t.value === tab)!.label;
  const intro = !advanced ? `The glasses ${name} pours into.` : wide ? `What ${name} pours into, the ice it pours and the tools behind the bar.` : undefined;
  return (
    <SetupChromeProvider value={{ ...chrome, title, intro, mark: undefined, eyebrow: null, progress: null, topLabel: step, noBack: false, onBack }}>
      <SetupPage footer={<Button label="Done, back to setup" size="lg" onPress={onDone} />}>
        {advanced ? <Segmented options={TABS} value={tab} onChange={setTab} accessibilityLabel="Kit" variant="pill" stretch /> : null}
        {tab === 'glassware' ? (
          <GlassesStep barId={barId} pageId={pageId} name={name} />
        ) : (
          <SubPageInline.Provider value>{tab === 'ice' ? <KitIceScreen barId={barId} /> : <KitToolsScreen barId={barId} />}</SubPageInline.Provider>
        )}
        {tab === 'glassware' ? (
          <SettingsSection note="Most bars start without them. Change it any time in Features.">
            <SwitchRow label={ADVANCED.label} detail={ADVANCED.detail} value={advanced} onValueChange={(on) => set('advanced', on)} />
          </SettingsSection>
        ) : null}
        {error ? (
          <Caption tone="accent" role="alert">
            {error}
          </Caption>
        ) : null}
      </SetupPage>
    </SetupChromeProvider>
  );
}
