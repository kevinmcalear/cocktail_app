import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Caption } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { useBarPageId, useFlushHeldGlasses } from '@/hooks/useBarGlassware';
import { useSetupChecklist } from '@/hooks/useSetupChecklist';
import { checklistIntro, type ChecklistKey } from '@/lib/setupChecklist';
import { useAppMode } from '@/store/useAppMode';

import { BrandsStep } from './BrandsStep';
import { GlassesStep } from './GlassesStep';
import { MenuStep } from './MenuStep';
import { ChecklistRow, ClaimNote } from './SetupChecklistParts';
import { TeamStep } from './TeamStep';

/**
 * "Set up Little Rye" (owner-setup step 5, calls 6 to 8): one checklist that
 * replaces What next. Your bar, Kit, Bottles, First menu, First drinks and
 * Your team; each row opens its screen, here in place (Kit, Bottles, First
 * menu, the team) or as a page (Your bar, a menu's drinks), and comes back
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
  const { list, notes, menuId, loading, skip, run } = useSetupChecklist(barId);
  const [at, setAt] = useState<ChecklistKey | null>(null);
  const back = () => setAt(null);
  const step = (key: ChecklistKey) => `Set up ${name} · ${list.rows.find((r) => r.key === key)?.title ?? ''}`;
  const open = (page: string) => {
    enterVenue(barId);
    router.push(page as Href);
  };

  if (at === 'kit') return <GlassesStep barId={barId} pageId={pageId} name={name} step={step('kit')} onBack={back} onNext={back} onSkip={() => (skip('kit'), back())} />;
  if (at === 'bottles') return <BrandsStep barId={barId} step={step('bottles')} onBack={back} onNext={back} onSkip={() => (skip('bottles'), back())} />;
  if (at === 'menu') return <MenuStep barId={barId} step={step('menu')} onBack={back} onDone={back} onSkip={() => (skip('menu'), back())} onBringIn={() => open('/bring-in')} />;
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
    drinks: () => (menuId ? open(`/menus/${menuId}/edit`) : setAt('menu')),
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
              <ChecklistRow key={r.key} n={i + 1} title={r.title} line={r.line} note={notes[r.key]} state={r.state} onPress={press[r.key]} />
            ))}
          </View>
        )}
        <ClaimNote barId={barId} />
      </SetupPage>
    </SetupChromeProvider>
  );
}
