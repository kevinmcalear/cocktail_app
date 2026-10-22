import { useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, TextLink } from '@/components/ds';
import { SetupChromeProvider, SetupFooter, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { SetupHead } from '@/components/screens/onboarding/SetupParts';
import { space } from '@/constants/tokens';
import { useItemLocations } from '@/hooks/useBackBar';
import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useVenueClassicCopies } from '@/hooks/useClassics';
import type { ReadFile } from '@/lib/readAnything';
import { makersLine, nextStep, setupLine, STEP_LABEL, type WhatNextStep } from '@/lib/whatNext';

import { ClassicsStep } from './ClassicsStep';
import { DoneStep } from './DoneStep';
import { GlassesStep } from './GlassesStep';
import { setupCopy } from './setupCopy';
import { BarDrawing, DeeperRow, StepChrome, StepRow } from './WhatNextParts';

type Props = ComponentProps<typeof DoneStep> & {
  /** Photos or PDFs picked on the menu step, being read in the background. */
  onFiles: (files: ReadFile[]) => void;
  /** Paste a link: Bring in opens to paste into. */
  onPaste: () => void;
};

// Venue settings pages for later, under "Go deeper when you want".
const DEEPER = [
  { path: 'ice', title: 'Your ice', line: 'Who makes it, what shapes' },
  { path: 'tools', title: 'Tools and kit', line: 'Tins, jiggers, the machines' },
  { path: 'suppliers', title: 'Who you buy from', line: 'Suppliers and reps' },
  { path: 'roles', title: 'Roles', line: 'Who can do what' },
] as const;

/**
 * "This is your bar. What next?" (eddie-oct22-wave2, fix 15): the end of
 * venue setup. A drawing of the bar's back bar fills in as it picks its
 * glasses and its menu; every step can wait, and each one is in Venue
 * settings later. The setup summary is one line, with See all.
 */
export function WhatNext(props: Props) {
  const { barId, name, claimState, waitingFiles, onOpen, onFiles, onPaste } = props;
  const router = useRouter();
  const base = useSetupChrome();
  const [view, setView] = useState<'hub' | 'all' | WhatNextStep>('hub');
  // Done or skipped here.
  const [passed, setPassed] = useState<WhatNextStep[]>([]);
  const glasses = useBarGlassware(barId).data ?? [];
  const bottles = (useItemLocations(barId).data ?? []).flatMap((l) => (l.item ? [l.item] : []));
  const copies = useVenueClassicCopies(barId).data ?? [];
  const invites = useBarInvites(barId).data ?? [];
  const filled: WhatNextStep[] = [...passed, ...(glasses.length ? (['glasses'] as const) : []), ...(copies.length ? (['menu'] as const) : [])];
  const next = nextStep(filled);
  const bar = name || 'your bar';
  const pass = (step: WhatNextStep) => {
    setPassed((p) => [...new Set([...p, step])]);
    // On to the next step not seen yet, else back here to see the bar filled in.
    setView(view === 'hub' ? 'hub' : (nextStep([...filled, step]) ?? 'hub'));
  };
  const hub = () => setView('hub');

  if (view === 'glasses') return <GlassesStep barId={barId} venueName={bar} onNext={() => pass('glasses')} onSkip={() => pass('glasses')} onBack={hub} />;
  if (view === 'menu') return <ClassicsStep barId={barId} onFiles={onFiles} onPaste={onPaste} onDone={() => pass('menu')} onSkip={() => pass('menu')} onBack={hub} />;
  if (view === 'all') {
    const copy = setupCopy('done', bar, claimState);
    return (
      <StepChrome title={copy.title} intro={copy.intro} onBack={hub}>
        <DoneStep {...props} />
      </StepChrome>
    );
  }

  const rows = {
    glasses: { title: 'Your glasses', line: (glasses.length && makersLine(glasses)) || 'What you pour into', done: glasses.length ? String(glasses.length) : null },
    menu: {
      title: 'Your menu',
      line: copies.length ? 'In your Library' : waitingFiles ? 'Being read, ready to check soon' : 'What’s on now, or 20 classics',
      done: copies.length ? `${copies.length} ${copies.length === 1 ? 'classic' : 'classics'}` : null,
    },
  };
  const page = (
    <SetupPage
      footer={
        next ? (
          <SetupFooter label={`Start with ${STEP_LABEL[next].toLowerCase()}`} onPress={() => setView(next)} skipLabel={`Open ${bar}, do this later`} onSkip={onOpen} />
        ) : (
          <SetupFooter label={`Open ${bar}`} onPress={onOpen} />
        )
      }
    >
      <BarDrawing name={bar} glasses={glasses} bottles={bottles} />
      {next ? <Caption tone="muted">Fill it in as you like. Every step can wait.</Caption> : null}
      <View style={styles.steps}>
        {(['glasses', 'menu'] as const).map((s, i) => (
          <StepRow key={s} at={i + 1} {...rows[s]} onPress={() => setView(s)} onSkip={filled.includes(s) ? undefined : () => pass(s)} />
        ))}
      </View>
      <View style={styles.summary}>
        <Caption tone="muted" style={styles.flex}>
          {setupLine({ invites: invites.length, claim: claimState, waitingFiles })}
        </Caption>
        <TextLink label="See all" tone="ink" onPress={() => setView('all')} />
      </View>
      <SetupHead>Go deeper when you want</SetupHead>
      <View>
        {DEEPER.map((d) => (
          <DeeperRow key={d.path} title={d.title} line={d.line} onPress={() => router.push(`/settings/bar/${barId}/${d.path}` as Href)} />
        ))}
      </View>
    </SetupPage>
  );
  if (!base) return page;
  return <SetupChromeProvider value={{ ...base, title: next ? 'This is your bar. What next?' : 'This is your bar.', intro: undefined }}>{page}</SetupChromeProvider>;
}

const styles = StyleSheet.create({
  steps: { gap: space.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
