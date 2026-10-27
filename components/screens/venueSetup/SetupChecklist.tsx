import { useRouter, type Href } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { FirstCocktailChoices, useStartFirstCocktail } from '@/components/screens/firstRound/FirstCocktailChoices';
import { SetupChromeProvider, SetupFooter, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { BrandSetup } from '@/components/screens/venue/BrandScreen';
import { radius, space } from '@/constants/tokens';
import { useBarPageId, useFlushHeldGlasses } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useKitFromDrinks } from '@/hooks/useKitFromDrinks';
import { useSetupChecklist } from '@/hooks/useSetupChecklist';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { checklistIntro, lookSet, type ChecklistKey } from '@/lib/setupChecklist';
import { useAppMode } from '@/store/useAppMode';
import { useBringIn } from '@/store/useBringIn';
import { useVenueSetup } from '@/store/useVenueSetup';

import { BrandsStep } from './BrandsStep';
import { FromDrinksStep, fromDrinksCount } from './FromDrinksStep';
import { StepFooter } from './GlassesStep';
import { KitStep } from './KitStep';
import { MenuStep } from './MenuStep';
import { ChecklistRow, ClaimNote, FromDrinksRow, LookFirstNote, NextCard } from './SetupChecklistParts';
import { setupCopy } from './setupCopy';
import { TeamStep } from './TeamStep';

/**
 * "Set up Little Rye" (owner-setup step 5, calls 6 to 8): one checklist that
 * replaces What next. Basic information, Kit, Bottles, First menu, First drinks and
 * Your team; each row opens its screen, here in place (Kit, Bottles, First
 * menu, the team) or as a page (Basic information, a menu's drinks), and comes back
 * here with a tick. Your team waits for How it looks, so the invite email
 * wears the bar's logo, colour and font (invite-team-last, call 2): until
 * the look is set it opens How it looks first, then goes on to the team.
 * The end of venue setup, the top of Library on a phone,
 * the first row of the sidebar on a desktop, and Venue settings' Setup.
 */
export function SetupChecklist({ barId, name, footer }: { barId: string; name: string; footer?: ReactNode }) {
  const chrome = useSetupChrome();
  const ds = useDs();
  const wide = useIsWideWeb();
  const router = useRouter();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const markDone = useVenueSetup((s) => s.markDone);
  const pageId = useBarPageId(barId).data ?? null;
  // Glasses picked before the page was checked go onto it once it is.
  useFlushHeldGlasses(barId);
  const { list, notes, menuId, inLibrary, reviewId, loading, skip, run } = useSetupChecklist(barId);
  // Only Prep adds to the Kit: nobody else loads what the drinks name (Kit and ice, step 12).
  const prep = (useCapabilities(barId).data ?? []).includes('prep');
  const fromDrinks = fromDrinksCount(useKitFromDrinks(prep ? barId : null), pageId);
  const startCocktail = useStartFirstCocktail();
  const brandQuery = useVenueBrand(barId);
  const brand = brandQuery.data;
  // The list waits for the brand too, so Your team can't be tapped past the gate before it loads; if it fails, the gate steps aside.
  const looks = brand ? lookSet(brand, run) : !!brandQuery.error;
  const busy = loading || brandQuery.isLoading;
  const [at, setAt] = useState<ChecklistKey | 'look' | 'fromDrinks' | null>(null);
  const back = () => setAt(null);
  const step = (key: ChecklistKey) => `Set up ${name} · ${list.rows.find((r) => r.key === key)?.title ?? ''}`;
  const open = (page: string) => {
    enterVenue(barId);
    router.push(page as Href);
  };

  // Done with nothing in the kit leaves it for later, like Skip.
  if (at === 'kit') return <KitStep barId={barId} pageId={pageId} name={name} step={step('kit')} onBack={back} onDone={() => (list.rows.some((r) => r.key === 'kit' && r.state === 'done') ? null : skip('kit'), back())} />;
  if (at === 'bottles') return <BrandsStep barId={barId} name={name} step={step('bottles')} onBack={back} onNext={back} onSkip={() => (skip('bottles'), back())} />;
  if (at === 'fromDrinks') return <FromDrinksStep barId={barId} pageId={pageId} name={name} onBack={back} />;
  if (at === 'menu') {
    return <MenuStep barId={barId} step={step('menu')} onBack={back} onDone={back} onSkip={() => (skip('menu'), back())} onBringIn={() => open('/bring-in')} onMade={(id) => open(`/menus/${id}/edit`)} />;
  }
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
      <SetupChromeProvider value={{ ...chrome, title: 'Invite your team', intro: `Each person gets an email from ${name} and lands in the app with your menus and specs already there.`, onBack: back }}>
        <TeamStep barId={barId} name={name} pending={false} onDone={(sent) => (sent.length ? null : skip('team'), back())} />
      </SetupChromeProvider>
    );
  }

  const press: Record<ChecklistKey, () => void> = {
    // Venue setup where it stopped; once it's through, Venue settings has the same pages.
    bar: () => router.push((run && !run.finished ? `/venue-setup?bar=${barId}` : `/settings/bar/${barId}`) as Href),
    kit: () => setAt('kit'),
    bottles: () => setAt('bottles'),
    menu: () => setAt('menu'),
    // The import still to check, carried on; else the drinks in the Library; else a menu to put some on.
    drinks: () => {
      if (reviewId) {
        useBringIn.getState().setReviewing(reviewId);
        open('/bring-in');
      } else if (inLibrary) {
        enterVenue(barId);
        router.navigate('/library');
      } else if (menuId) open(`/menus/${menuId}/edit`);
      else setAt('menu');
    },
    team: () => setAt(looks ? 'team' : 'look'),
  };
  // While the look isn't set, the first row says so too (invite-team-last, step 2).
  const barLine = looks ? undefined : 'Where, who sees it · How it looks not set';
  const teamLine = looks ? `Invite who works here, in ${name}’s look` : `After how ${name} looks: the invite wears it`;
  const next = list.rows.find((r) => r.key === list.next);
  // The rows in one card, the claim under it; on wide web the Next card sits beside them (owner-setup step 5).
  const column = (
    <View style={styles.column}>
      {busy ? (
        <Caption tone="muted">Loading…</Caption>
      ) : (
        <View role="list" accessibilityLabel={`Set up ${name}`} style={[styles.card, { backgroundColor: ds.c.surface }]}>
          {list.rows.map((r, i) => (
            <Fragment key={r.key}>
              <ChecklistRow n={i + 1} first={i === 0} title={r.title} line={r.key === 'team' && r.state !== 'done' ? teamLine : r.key === 'bar' ? (barLine ?? r.line) : r.line} note={notes[r.key]} state={r.state} action={r.key === 'team' ? 'Invite' : undefined} onPress={press[r.key]} />
              {/* Until there are drinks, the first round's four starts, coming back here once saved. */}
              {r.key === 'drinks' && r.state !== 'done' ? (
                <View style={styles.starts}>
                  <FirstCocktailChoices onPick={(start) => (enterVenue(barId), startCocktail(barId, start, true))} />
                </View>
              ) : null}
            </Fragment>
          ))}
        </View>
      )}
      {fromDrinks ? <FromDrinksRow count={fromDrinks} onPress={() => setAt('fromDrinks')} /> : null}
      <ClaimNote barId={barId} />
    </View>
  );
  return (
    <SetupChromeProvider value={{ ...chrome, title: `Set up ${name}`, intro: busy ? undefined : checklistIntro(list), frameWidth: 'wide' }}>
      <SetupPage footer={footer}>
        {wide && next && !busy ? (
          <View style={styles.split}>
            {column}
            <NextCard title={next.title} line={next.next} />
          </View>
        ) : (
          column
        )}
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0, maxWidth: 608, gap: space.lg },
  card: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.card, borderCurve: 'continuous' },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  // Under the row's title: past its 32 px mark and the gap.
  starts: { paddingLeft: 32 + space.md, paddingVertical: space.sm },
});
