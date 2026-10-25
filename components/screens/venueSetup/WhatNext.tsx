import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { SetupHead } from '@/components/screens/onboarding/SetupParts';
import { space } from '@/constants/tokens';
import { useBackBarStock } from '@/hooks/useBackBar';
import { useBarGlassware, useBarPageId, useFlushHeldGlasses, useHeldGlasses } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useKitFromDrinks } from '@/hooks/useKitFromDrinks';
import { useVenueMenus } from '@/hooks/useMenus';
import { useBarClassics, useTopClassics } from '@/hooks/useWhatNext';
import { groupMenus } from '@/lib/menus';
import { glassMakers, heldNotOnPage } from '@/lib/whatNext';
import { useAppMode } from '@/store/useAppMode';

import { BrandsStep } from './BrandsStep';
import { FromDrinksStep, fromDrinksCount } from './FromDrinksStep';
import { GlassesStep } from './GlassesStep';
import { MenuStep } from './MenuStep';
import { BackBarShelf, DeeperRow, StepRow } from './WhatNextParts';

type Step = 'glasses' | 'brands' | 'menu';
/** What next's steps, and From your drinks (Kit and ice, step 12), which isn't numbered. */
type At = Step | 'drinks';

const STEP_WORD: Record<Step, string> = { glasses: 'Glasses', brands: 'Brands', menu: 'Menu' };
const ORDER: Step[] = ['glasses', 'brands', 'menu'];

/**
 * "This is your bar. What next?" (board eddie-oct22-wave2, fix 15): the
 * bar's back bar drawn on top, filling with each glass and bottle picked,
 * and steps that can each wait: your glasses, your brands, your menu. Once
 * each is done or skipped, what's there and "Go deeper when you want". The
 * end of venue setup, and Venue settings' What next.
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
  const stockQuery = useBackBarStock(barId);
  const menusQuery = useVenueMenus(barId);
  const held = useHeldGlasses(barId);
  // Glasses picked before the page was checked go onto it once it is.
  useFlushHeldGlasses(barId);
  const top = useTopClassics();
  const libraryQuery = useBarClassics(barId, top.classics);
  const caps = capsQuery.data ?? [];
  const pageId = pageQuery.data ?? null;
  // Only Prep adds to the Kit: nobody else loads what the drinks name.
  const fromDrinks = fromDrinksCount(useKitFromDrinks(caps.includes('prep') ? barId : null), pageId);
  // On the page, then held on this device until it's checked (a held one already saved isn't counted twice).
  const onPage = glassQuery.data ?? [];
  const glasses = [...onPage, ...heldNotOnPage(held, onPage).map((h) => ({ ...h, id: h.key, maker_page: null }))];
  const stock = stockQuery.data ?? [];
  const inLibrary = (libraryQuery.data ?? []).length;
  // A menu on now, coming up or a draft: a claimed bar's past menus (its history) aren't a first menu.
  const [now] = useState(() => Date.now());
  const menuGroups = groupMenus(menusQuery.data ?? [], now);
  const menus = menuGroups.on.length + menuGroups.upcoming.length + menuGroups.draft.length;
  // What's there decides which steps show and whether it's filled in: wait for it, not a flash of the wrong one.
  // Once shown, it stays: a later key change (the rankings arriving) never puts Loading back.
  const [shown, setShown] = useState(false);
  const loading = !shown && (capsQuery.isLoading || pageQuery.isLoading || glassQuery.isLoading || stockQuery.isLoading || top.isLoading || libraryQuery.isLoading || menusQuery.isLoading);
  if (!loading && !shown) setShown(true);
  const [at, setAt] = useState<At | null>(null);
  const [skipped, setSkipped] = useState<Step[]>([]);
  // Glassware hangs off the venue's page: before it's checked, picks wait on this device (GlassesStep).
  const can: Record<Step, boolean> = { glasses: caps.includes('prep'), brands: caps.includes('edit_drinks') || caps.includes('prep'), menu: caps.includes('edit_drinks') };
  const steps = ORDER.filter((s) => can[s]);
  const counts: Record<Step, number> = { glasses: glasses.length, brands: stock.length, menu: menus + inLibrary };
  const has = (s: Step) => counts[s] > 0;
  const left = steps.filter((s) => !has(s) && !skipped.includes(s));
  const filled = left.length === 0;
  // Numbered as the rows are, whether or not every step can be done here.
  const label = (s: Step) => `${ORDER.indexOf(s) + 1} of ${ORDER.length} · ${STEP_WORD[s]}`;
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
  if (at === 'glasses') {
    return <GlassesStep barId={barId} pageId={pageId} name={name} step={label('glasses')} onBack={() => setAt(null)} onNext={() => next('glasses')} onSkip={() => (skip('glasses'), next('glasses'))} />;
  }
  if (at === 'drinks') {
    return <FromDrinksStep barId={barId} pageId={pageId} name={name} onBack={() => setAt(null)} />;
  }
  if (at === 'brands') {
    return <BrandsStep barId={barId} step={label('brands')} onBack={() => setAt(null)} onNext={() => next('brands')} onSkip={() => (skip('brands'), next('brands'))} />;
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
        onMade={(menuId) => {
          onLeave?.();
          enterVenue(barId);
          router.push(`/menus/${menuId}/edit` as Href);
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
            {first ? <Button label={startLabel(first, steps.slice(0, steps.indexOf(first)).some((s) => has(s) || skipped.includes(s)))} size="lg" onPress={() => setAt(first)} /> : null}
            <Button label={first ? `${openLabel}, do this later` : openLabel} size="lg" variant={first ? 'ghost' : 'primary'} onPress={onOpen} />
          </>
        }
      >
        <BackBarShelf name={name} glasses={glasses} bottles={can.brands ? stock.map((r) => r.item ?? { id: r.item_id, name: '' }) : null} />
        {filled ? null : <Caption tone="muted">Fill it in as you like. Every step can wait.</Caption>}
        <View style={styles.steps}>
          <StepRow
            n={1}
            title="Your glasses"
            line={glasses.length ? glassMakers(glasses) || 'On your shelf' : can.glasses ? 'What you pour into' : 'Needs Prep at this venue'}
            count={glasses.length ? String(glasses.length) : null}
            skipped={skipped.includes('glasses')}
            onPress={can.glasses ? () => setAt('glasses') : undefined}
            onSkip={can.glasses ? () => skip('glasses') : undefined}
          />
          <StepRow
            n={2}
            title="Your brands"
            line={stock.length ? 'On your back bar' : can.brands ? 'What’s on your shelves' : 'Needs drink edits or Prep at this venue'}
            count={stock.length ? String(stock.length) : null}
            skipped={skipped.includes('brands')}
            onPress={can.brands ? () => setAt('brands') : undefined}
            onSkip={can.brands ? () => skip('brands') : undefined}
          />
          <StepRow
            n={3}
            title="Your menu"
            line={menus ? 'In Menus' : inLibrary ? 'In your Library' : can.menu ? 'Start your own, or bring one in' : 'Needs drink edits at this venue'}
            count={menus ? `${menus} ${menus === 1 ? 'menu' : 'menus'}` : inLibrary ? `${inLibrary} ${inLibrary === 1 ? 'classic' : 'classics'}` : null}
            skipped={skipped.includes('menu')}
            onPress={can.menu ? () => setAt('menu') : undefined}
            onSkip={can.menu ? () => skip('menu') : undefined}
          />
        </View>
        {fromDrinks && can.glasses ? (
          <DeeperRow title="From your drinks" line={`${fromDrinks} ${fromDrinks === 1 ? 'thing your drinks name isn’t' : 'things your drinks name aren’t'} in your Kit`} onPress={() => setAt('drinks')} />
        ) : null}
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

/** "Start with glasses", "Start with your brands", or "Next: your menu" once an earlier step is done or skipped. */
function startLabel(s: Step, after: boolean): string {
  const what = s === 'glasses' ? 'glasses' : `your ${s}`;
  return after ? `Next: your ${s}` : `Start with ${what}`;
}

const styles = StyleSheet.create({
  steps: { gap: space.sm },
});
