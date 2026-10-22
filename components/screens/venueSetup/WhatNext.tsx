import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { SetupHead } from '@/components/screens/onboarding/SetupParts';
import { space } from '@/constants/tokens';
import { useBarGlassware, useBarPageId } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useBarClassics, useTopClassics } from '@/hooks/useWhatNext';
import { glassMakers } from '@/lib/whatNext';
import { useAppMode } from '@/store/useAppMode';

import { GlassesStep } from './GlassesStep';
import { MenuStep } from './MenuStep';
import { BackBarShelf, DeeperRow, StepRow } from './WhatNextParts';

type Step = 'glasses' | 'menu';

/**
 * "This is your bar. What next?" (board eddie-oct22-wave2, fix 15): the
 * bar's back bar drawn on top, filling with each glass picked, and steps
 * that can each wait: your glasses, your menu. Once each is done or skipped,
 * what's there and "Go deeper when you want". The end of venue setup, and
 * Venue settings' What next.
 *
 * ponytail: brands (what's on your shelves) waits on fix 12's stock list;
 * it joins as step 2 then, with bottles on a second shelf.
 */
export function WhatNext({
  barId,
  name,
  summary,
  openLabel,
  onOpen,
  onLeave,
}: {
  barId: string;
  name: string;
  summary?: ReactNode;
  openLabel: string;
  onOpen: () => void;
  /** Before Bring in or a Venue settings page takes over (setup marks itself finished). */
  onLeave?: () => void;
}) {
  const chrome = useSetupChrome();
  const router = useRouter();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const capsQuery = useCapabilities(barId);
  const pageQuery = useBarPageId(barId);
  const glassQuery = useBarGlassware(barId);
  const top = useTopClassics();
  const libraryQuery = useBarClassics(barId, top.classics);
  const caps = capsQuery.data ?? [];
  const pageId = pageQuery.data ?? null;
  const glasses = glassQuery.data ?? [];
  const inLibrary = (libraryQuery.data ?? []).length;
  // What's there decides which steps show and whether it's filled in: wait for it, not a flash of the wrong one.
  // Once shown, it stays: a later key change (the rankings arriving) never puts Loading back.
  const [shown, setShown] = useState(false);
  const loading = !shown && (capsQuery.isLoading || pageQuery.isLoading || glassQuery.isLoading || top.isLoading || libraryQuery.isLoading);
  if (!loading && !shown) setShown(true);
  const [at, setAt] = useState<Step | null>(null);
  const [skipped, setSkipped] = useState<Step[]>([]);
  // Glassware hangs off the venue's page, so it waits for the claim.
  const canGlasses = caps.includes('prep') && !!pageId;
  const canMenu = caps.includes('edit_drinks');
  const steps: Step[] = [...(canGlasses ? (['glasses'] as const) : []), ...(canMenu ? (['menu'] as const) : [])];
  const has = (s: Step) => (s === 'glasses' ? glasses.length : inLibrary) > 0;
  const left = steps.filter((s) => !has(s) && !skipped.includes(s));
  const filled = left.length === 0;
  // Numbered as the rows are, whether or not glasses can be done yet.
  const label = (s: Step) => (s === 'glasses' ? '1 of 2 · Glasses' : '2 of 2 · Menu');
  const skip = (s: Step) => setSkipped((xs) => (xs.includes(s) ? xs : [...xs, s]));
  // After a step: the next one not skipped, else back here.
  const next = (s: Step) => setAt(steps.slice(steps.indexOf(s) + 1).find((x) => !skipped.includes(x)) ?? null);

  if (loading) {
    return (
      <SetupChromeProvider value={{ ...chrome, title: 'This is your bar. What next?', intro: undefined }}>
        <SetupPage>
          <Caption tone="muted">Loading…</Caption>
        </SetupPage>
      </SetupChromeProvider>
    );
  }
  if (at === 'glasses' && pageId) {
    return <GlassesStep barId={barId} pageId={pageId} step={label('glasses')} onBack={() => setAt(null)} onNext={() => next('glasses')} onSkip={() => (skip('glasses'), next('glasses'))} />;
  }
  if (at === 'menu') {
    return (
      <MenuStep
        barId={barId}
        step={label('menu')}
        onBack={() => setAt(null)}
        onDone={() => setAt(null)}
        onSkip={() => (skip('menu'), setAt(null))}
        onBringIn={() => {
          onLeave?.();
          enterVenue(barId);
          router.push('/bring-in' as Href);
        }}
      />
    );
  }

  const first = left[0];
  const go = (page: string) => () => {
    onLeave?.();
    router.push(`/settings/bar/${barId}/${page}` as Href);
  };
  return (
    <SetupChromeProvider value={{ ...chrome, title: filled ? 'This is your bar.' : 'This is your bar. What next?', intro: undefined }}>
      <SetupPage
        footer={
          <>
            {first ? <Button label={first === 'glasses' ? 'Start with glasses' : skipped.includes('glasses') || has('glasses') ? 'Next: your menu' : 'Start with your menu'} size="lg" onPress={() => setAt(first)} /> : null}
            <Button label={first ? `${openLabel}, do this later` : openLabel} size="lg" variant={first ? 'ghost' : 'primary'} onPress={onOpen} />
          </>
        }
      >
        <BackBarShelf name={name} glasses={glasses} />
        {filled ? null : <Caption tone="muted">Fill it in as you like. Every step can wait.</Caption>}
        <View style={styles.steps}>
          <StepRow
            n={1}
            title="Your glasses"
            line={glasses.length ? glassMakers(glasses) || 'On your shelf' : canGlasses ? 'What you pour into' : pageId ? 'Needs Prep at this venue' : 'Once your page is checked'}
            count={glasses.length ? String(glasses.length) : null}
            skipped={skipped.includes('glasses')}
            onPress={canGlasses ? () => setAt('glasses') : undefined}
            onSkip={canGlasses ? () => skip('glasses') : undefined}
          />
          <StepRow
            n={2}
            title="Your menu"
            line={inLibrary ? 'In your Library' : canMenu ? 'What’s on now, or 20 classics' : 'Needs drink edits at this venue'}
            count={inLibrary ? `${inLibrary} ${inLibrary === 1 ? 'classic' : 'classics'}` : null}
            skipped={skipped.includes('menu')}
            onPress={canMenu ? () => setAt('menu') : undefined}
            onSkip={canMenu ? () => skip('menu') : undefined}
          />
        </View>
        {summary}
        {filled ? (
          <View>
            <SetupHead>Go deeper when you want</SetupHead>
            <DeeperRow title="Your ice" line="Who makes it, what shapes" onPress={go('ice')} />
            <DeeperRow title="Tools and kit" line="Tins, jiggers, the machines" onPress={go('tools')} />
            <DeeperRow title="Who you buy from" line="Suppliers and reps" onPress={go('suppliers')} />
          </View>
        ) : null}
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  steps: { gap: space.sm },
});
