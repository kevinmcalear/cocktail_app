import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { StepGroup } from '@/components/screens/firstRound/StepGroup';
import { SetupChromeProvider, SetupFooter, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { BrandSetup } from '@/components/screens/venue/BrandScreen';
import { space } from '@/constants/tokens';
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
import { MenuStep } from './MenuStep';
import { LookFirstNote } from './SetupChecklistParts';
import { setupCopy } from './setupCopy';
import { TeamStep } from './TeamStep';

/**
 * "Set up Little Rye" (board Kept-onboard, Owner after the three steps): eight
 * rows, done ones ticked in green, the rest each opening its screen, here in
 * place (the glassware, a first menu, the theme, the team) or as a page (the
 * claim, where and when, who sees your page, calendars), and coming back here.
 * Your team waits for the theme, so the invite email wears the bar's logo,
 * colour and font (invite-team-last, call 2). The end of venue setup, the top
 * of Library on a phone, the first row of the sidebar on a desktop, and Venue
 * settings' Setup.
 */
export function SetupChecklist({ barId, name, footer }: { barId: string; name: string; footer?: ReactNode }) {
  const chrome = useSetupChrome();
  const wide = useIsWideWeb();
  const router = useRouter();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const markDone = useVenueSetup((s) => s.markDone);
  const pageId = useBarPageId(barId).data ?? null;
  // Glasses picked before the page was checked go onto it once it is.
  useFlushHeldGlasses(barId);
  const { list, lines, menuId, looks, loading, skip, run } = useSetupChecklist(barId);
  // Only Prep adds to the Kit: nobody else loads what the drinks name (Kit and ice, step 12).
  const prep = (useCapabilities(barId).data ?? []).includes('prep');
  const fromDrinks = fromDrinksCount(useKitFromDrinks(prep ? barId : null), pageId);
  const [at, setAt] = useState<'glassware' | 'fromDrinks' | 'menu' | 'theme' | 'look' | 'team' | null>(null);
  const back = () => setAt(null);
  const step = (key: ChecklistKey) => `Set up ${name} · ${list.rows.find((r) => r.key === key)?.title ?? ''}`;
  const open = (page: string) => {
    enterVenue(barId);
    router.push(page as Href);
  };

  // Done with no glasses leaves the row for later, like Skip.
  if (at === 'glassware') return <KitStep barId={barId} pageId={pageId} name={name} step={step('glassware')} onBack={back} onDone={() => (list.rows.some((r) => r.key === 'glassware' && r.state === 'done') ? null : skip('glassware'), back())} />;
  if (at === 'fromDrinks') return <FromDrinksStep barId={barId} pageId={pageId} name={name} onBack={back} />;
  if (at === 'menu') {
    return <MenuStep barId={barId} step={step('menu')} onBack={back} onDone={back} onSkip={() => (skip('menu'), back())} onBringIn={() => open('/bring-in')} onMade={(id) => open(`/menus/${id}/edit`)} />;
  }
  // Done on the theme counts as set even when they kept the app's look, so Your team stops asking.
  // Only on this device's run: making one here would put the checklist back on a venue set up elsewhere.
  const lookedAt = (then: () => void) => {
    if (run) markDone(barId, 'look');
    then();
  };
  if (at === 'theme' || at === 'look') {
    // From Your team (the gate) it goes on to the team; from Theme it comes back here.
    const onToTeam = at === 'look';
    return (
      <SetupChromeProvider value={{ ...chrome, ...setupCopy('look', name), title: onToTeam ? `How ${name} looks` : 'Theme', mark: onToTeam ? <LookFirstNote /> : undefined, onBack: back }}>
        <BrandSetup
          barId={barId}
          setup={{
            // A phone walks the look one part at a time, as venue setup does (E34); Done comes on the last.
            footer: ({ save, saving, ok, page }) =>
              page?.next ? (
                <StepFooter skip="Back" onSkip={page.at === 0 ? back : page.onBack} label={`Next: ${page.next}`} onPress={page.onNext} />
              ) : (
                <SetupFooter label={onToTeam ? 'Done, on to your team' : 'Done'} pending={saving} disabled={!ok} onPress={() => save(() => lookedAt(() => setAt(onToTeam ? 'team' : null)))} />
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
    claim: () => router.push(`/venue-setup?bar=${barId}&step=claim` as Href),
    // Tonight's menu, or the one being made; with none, start one or bring one in, here.
    menu: () => (menuId ? open(`/menus/${menuId}/edit`) : setAt('menu')),
    // Venue setup where it stopped; once it's through, Venue settings has the same page.
    where: () => router.push((run && !run.finished ? `/venue-setup?bar=${barId}` : `/settings/bar/${barId}`) as Href),
    // What the drinks name that isn't in the Kit yet, else the glasses themselves.
    glassware: () => setAt(fromDrinks ? 'fromDrinks' : 'glassware'),
    team: () => setAt(looks ? 'team' : 'look'),
    visibility: () => router.push(`/settings/bar/${barId}/publishing` as Href),
    theme: () => setAt('theme'),
    calendars: () => router.push(`/settings/bar/${barId}/calendars` as Href),
  };
  const rows = list.rows.map((r) => {
    const own = lines[r.key];
    return {
      key: r.key,
      title: r.title,
      // A row skipped for now says so; a done one shows what's there (Tonight's menu) or nothing.
      sub: r.state === 'skipped' ? `${own ?? r.line} · Skipped for now` : own === undefined ? (r.state === 'done' ? null : r.line) : own,
      value: r.state === 'done' ? 'Done' : null,
      done: r.state === 'done',
      onPress: press[r.key],
    };
  });
  return (
    <SetupChromeProvider value={{ ...chrome, title: `Set up ${name}`, eyebrow: loading ? null : checklistEyebrow(list), intro: 'The rest can wait. Do them when you have a minute.' }}>
      <SetupPage footer={footer}>
        <View style={styles.column}>{loading ? <Caption tone="muted">Loading…</Caption> : <StepGroup rows={rows} label={`Set up ${name}`} />}</View>
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0, maxWidth: 608, gap: space.lg },
});
