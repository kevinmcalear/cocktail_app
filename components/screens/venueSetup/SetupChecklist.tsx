import { useRouter, type Href } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { FirstCocktailChoices, useStartFirstCocktail } from '@/components/screens/firstRound/FirstCocktailChoices';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { space } from '@/constants/tokens';
import { useBarPageId, useFlushHeldGlasses } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useKitFromDrinks } from '@/hooks/useKitFromDrinks';
import { useSetupChecklist } from '@/hooks/useSetupChecklist';
import { checklistIntro, type ChecklistKey } from '@/lib/setupChecklist';
import { useAppMode } from '@/store/useAppMode';
import { useBringIn } from '@/store/useBringIn';

import { BrandsStep } from './BrandsStep';
import { FromDrinksStep, fromDrinksCount } from './FromDrinksStep';
import { KitStep } from './KitStep';
import { MenuStep } from './MenuStep';
import { ChecklistRow, ClaimNote, FromDrinksRow } from './SetupChecklistParts';
import { TeamStep } from './TeamStep';

/**
 * "Set up Little Rye" (owner-setup step 5, calls 6 to 8): one checklist that
 * replaces What next. Basic information, Kit, Bottles, First menu, First drinks and
 * Your team; each row opens its screen, here in place (Kit, Bottles, First
 * menu, the team) or as a page (Basic information, a menu's drinks), and comes back
 * here with a tick. The end of venue setup, the top of Library on a phone,
 * the first row of the sidebar on a desktop, and Venue settings' Setup.
 */
export function SetupChecklist({ barId, name, footer }: { barId: string; name: string; footer?: ReactNode }) {
  const chrome = useSetupChrome();
  const router = useRouter();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const pageId = useBarPageId(barId).data ?? null;
  // Glasses picked before the page was checked go onto it once it is.
  useFlushHeldGlasses(barId);
  const { list, notes, menuId, inLibrary, reviewId, loading, skip, run } = useSetupChecklist(barId);
  // Only Prep adds to the Kit: nobody else loads what the drinks name (Kit and ice, step 12).
  const prep = (useCapabilities(barId).data ?? []).includes('prep');
  const fromDrinks = fromDrinksCount(useKitFromDrinks(prep ? barId : null), pageId);
  const startCocktail = useStartFirstCocktail();
  const [at, setAt] = useState<ChecklistKey | 'fromDrinks' | null>(null);
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
    team: () => setAt('team'),
  };
  return (
    <SetupChromeProvider value={{ ...chrome, title: `Set up ${name}`, intro: loading ? undefined : checklistIntro(list) }}>
      <SetupPage footer={footer}>
        {loading ? (
          <Caption tone="muted">Loading…</Caption>
        ) : (
          <View role="list" accessibilityLabel={`Set up ${name}`}>
            {list.rows.map((r, i) => (
              <Fragment key={r.key}>
                <ChecklistRow n={i + 1} title={r.title} line={r.line} note={notes[r.key]} state={r.state} onPress={press[r.key]} />
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
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  // Under the row's title: past its 32 px mark and the gap.
  starts: { paddingLeft: 32 + space.md, paddingVertical: space.sm },
});
