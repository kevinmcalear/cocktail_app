import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { OutlineRows } from '@/components/ds/ListGroup';
import { StepGroup, type StepRowData } from '@/components/screens/firstRound/StepGroup';
import { SetupChromeProvider, SetupFooter, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { BrandSetup } from '@/components/screens/venue/BrandScreen';
import { displayFaces, font, space } from '@/constants/tokens';
import { useBarPageId, useFlushHeldGlasses } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useKitFromDrinks } from '@/hooks/useKitFromDrinks';
import { useSetupChecklist } from '@/hooks/useSetupChecklist';
import { checklistEyebrow, type ChecklistKey } from '@/lib/setupChecklist';
import { useAppMode } from '@/store/useAppMode';
import { useVenueSetup } from '@/store/useVenueSetup';

import { FromDrinksStep, fromDrinksCount } from './FromDrinksStep';
import { StepFooter } from './GlassesStep';
import { KitStep } from './KitStep';
import { LookFirstNote } from './SetupChecklistParts';
import { setupCopy } from './setupCopy';
import { TeamStep } from './TeamStep';

/**
 * "Set up Little Rye" (board Kept-onboard, "Owner, after the three steps"):
 * Owner · 3 of 8 done, the title, "The rest can wait", and eight rows, a
 * ring until done and a green Done after. Each row opens its screen:
 * Glassware and the team here in place, the rest as their own pages, and
 * Tonight's menu straight into the camera. Your team waits for the bar's look,
 * so the invite wears it (invite-team-last, call 2). The end of venue setup,
 * the top of Drinks on a phone, the sidebar on a desktop, and Venue settings.
 */
export function SetupChecklist({ barId, name, onBack, backLabel = 'Back' }: { barId: string; name: string; onBack?: () => void; backLabel?: string }) {
  const chrome = useSetupChrome();
  const ds = useDs();
  const wide = useIsWideWeb();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const markDone = useVenueSetup((s) => s.markDone);
  const pageId = useBarPageId(barId).data ?? null;
  // Glasses picked before the page was checked go onto it once it is.
  useFlushHeldGlasses(barId);
  const { list, notes, looks, loading, skip, run } = useSetupChecklist(barId);
  // Only Prep adds to the Kit from the drinks (Kit and ice, step 12).
  const prep = (useCapabilities(barId).data ?? []).includes('prep');
  const fromDrinks = fromDrinksCount(useKitFromDrinks(prep ? barId : null), pageId);
  const [at, setAt] = useState<'kit' | 'fromDrinks' | 'look' | 'team' | null>(null);
  const back = () => setAt(null);
  const step = (key: ChecklistKey) => `Set up ${name} · ${list.rows.find((r) => r.key === key)?.title ?? ''}`;
  const go = (href: string) => router.push(href as Href);

  // Done with nothing in the kit leaves it for later, like Skip.
  if (at === 'kit') return <KitStep barId={barId} pageId={pageId} name={name} step={step('glass')} onBack={back} onDone={() => (list.rows.some((r) => r.key === 'glass' && r.state === 'done') ? null : skip('glass'), back())} />;
  if (at === 'fromDrinks') return <FromDrinksStep barId={barId} pageId={pageId} name={name} onBack={back} />;
  // Done on How it looks counts as set even when they kept the app's look, so Your team stops asking.
  // Only on this device's run: making one here would put the checklist back on a venue set up elsewhere.
  const lookedAt = () => {
    if (run) markDone(barId, 'look');
    setAt('team');
  };
  if (at === 'look') {
    return (
      <SetupChromeProvider value={{ ...chrome, ...setupCopy('look', name), title: `How ${name} looks`, mark: <LookFirstNote />, onBack: back }}>
        <BrandSetup
          barId={barId}
          setup={{
            // A phone walks the look one part at a time, as venue setup does (E34); Done comes on the last.
            footer: ({ save, saving, ok, page }) =>
              page?.next ? (
                <StepFooter skip="Back" onSkip={page.at === 0 ? back : page.onBack} label={`Next: ${page.next}`} onPress={page.onNext} />
              ) : (
                <SetupFooter label="Done, on to your team" pending={saving} disabled={!ok} onPress={() => save(lookedAt)} />
              ),
          }}
        />
      </SetupChromeProvider>
    );
  }
  if (at === 'team') {
    return (
      <SetupChromeProvider
        value={{
          ...chrome,
          title: 'Invite your team',
          intro: wide ? 'Write on the left, see each person’s email on the right.' : `Each person gets one email from ${name}, in your look, with your welcome and their own note.`,
          frameWidth: 'wide',
          onBack: back,
        }}
      >
        <TeamStep barId={barId} name={name} pending={false} onDone={(sent) => (sent.length ? null : skip('team'), back())} />
      </SetupChromeProvider>
    );
  }

  const press: Record<ChecklistKey, () => void> = {
    claim: () => go(`/venue-setup?bar=${barId}&step=claim`),
    // Straight into the camera (board Prod-first-owner, step 3).
    menu: () => {
      enterVenue(barId);
      go(`/bring-in?step=${encodeURIComponent(step('menu'))}`);
    },
    // Venue setup where it stopped while that step is still to do; after, Venue settings has it.
    place: () => go(run && !run.finished && !run.done.includes('place') ? `/venue-setup?bar=${barId}` : `/settings/bar/${barId}`),
    glass: () => setAt(fromDrinks ? 'fromDrinks' : 'kit'),
    team: () => setAt(looks ? 'team' : 'look'),
    visibility: () => go(`/settings/bar/${barId}/publishing`),
    theme: () => go(`/settings/bar/${barId}/theme`),
    calendars: () => go(`/settings/bar/${barId}/calendars`),
  };
  const rows: StepRowData[] = list.rows.map((r) => {
    const done = r.state === 'done';
    const sub = done ? notes[r.key] : r.state === 'skipped' ? `${r.line} · Skipped for now` : r.line;
    return { key: r.key, title: r.title, sub, value: done ? 'Done' : null, done, onPress: press[r.key] };
  });
  const italic = { fontFamily: displayFaces[ds.displayFace].italic };

  return (
    <ScrollView style={{ backgroundColor: ds.c.ground }} contentContainerStyle={[styles.page, { paddingTop: insets.top + (onBack ? space.sm : space.xxl), paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }]}>
      {onBack ? <GlassButton icon="chevron.left" accessibilityLabel={backLabel} onPress={onBack} /> : null}
      <View style={styles.head}>
        <Caption tone="muted" style={styles.eyebrow}>
          {checklistEyebrow(list).toUpperCase()}
        </Caption>
        <Title>{`Set up ${name}`}</Title>
        <Body tone="muted" style={italic}>
          The rest can wait. Do them when you have a minute.
        </Body>
      </View>
      {loading ? <OutlineRows count={8} round pic={20} /> : <StepGroup rows={rows} label={`Set up ${name}`} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 608, alignSelf: 'center', gap: space.lg },
  head: { gap: space.xs, paddingTop: space.md },
  eyebrow: { ...font.semiBold, letterSpacing: 1.2 },
});
