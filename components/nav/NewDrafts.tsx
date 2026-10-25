import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMenuSectionPlace } from '@/hooks/useDrinkDesk';
import { COUNTED_STEPS, hasContent, WIZARD_STEPS, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { recipesToFinish } from '@/lib/prepKinds';
import { slotStart } from '@/lib/wizardSlots';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

/**
 * Drafts, at the top of New (make-anything-steps-1, step 1): one entry per
 * drink started here and not saved, newest first, with where it's going and
 * the step it was left at, and the recipes still to finish inside it under
 * it. A tap goes straight back to it. Signed in, they're kept in the
 * account too (hooks/useDraftSync), so another phone or the web lists them.
 */
export function NewDrafts({ barId, onOpen }: { barId: string | null; onOpen: (params: Record<string, string>) => void }) {
  const kept = useDrinkWizardStore((s) => s.kept);
  const signedIn = !!useAuth().session;
  const place = wizardPlace(barId);
  const drafts = Object.entries(kept)
    .filter(([slot, k]) => slotStart(slot).place === place && hasContent(k.draft))
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
  if (!drafts.length) return null;
  return (
    <View style={styles.list}>
      <Caption tone="muted" style={styles.head}>
        DRAFTS
      </Caption>
      {drafts.map(([slot, k]) => (
        <DraftRow key={slot} slot={slot} draft={k.draft} step={k.step} barId={barId} onOpen={onOpen} />
      ))}
      {signedIn ? <Caption tone="muted">Kept in your account, so your other phone and the web see them too.</Caption> : null}
    </View>
  );
}

function DraftRow({ slot, draft, step, barId, onOpen }: { slot: string; draft: WizardDraft; step: WizardStep; barId: string | null; onOpen: (params: Record<string, string>) => void }) {
  const ds = useDs();
  const start = slotStart(slot);
  const menu = useMenuSectionPlace(start.menuSectionId).data?.menu ?? null;
  const title = draft.name.trim() || 'Untitled drink';
  const at = Math.min(WIZARD_STEPS.indexOf(step) + 1, COUNTED_STEPS);
  // The desktop page has no steps: a draft never moved past its name is just a drink.
  const where = [menu, step === 'name' ? 'drink' : `drink, at ${step === 'review' ? 'the review' : `${at} of ${COUNTED_STEPS}`}`].filter(Boolean).join(' · ');
  const left = recipesToFinish(draft.lines);
  const open = () =>
    onOpen({
      ...(barId ? { barId } : {}),
      ...(start.menuSectionId ? { menuSectionId: start.menuSectionId } : {}),
      ...(start.name ? { name: start.name } : {}),
      ...(start.from ? { from: start.from } : {}),
    });
  return (
    <PressableScale role="link" accessibilityLabel={[`${title}, ${where}`, ...left.map((t) => `${t.name}, recipe to finish`)].join('. ')} onPress={open} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Body style={{ fontFamily: fontFamilies.bodySemiBold }} numberOfLines={1}>
        {title}
      </Body>
      <Caption tone="muted">{where}</Caption>
      {left.map((t) => (
        <Caption key={`${t.depth}:${t.name}`} tone="accent" style={{ paddingLeft: space.md * (t.depth + 1) }}>
          {`${t.name} · recipe to finish`}
        </Caption>
      ))}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  list: { marginBottom: space.md },
  head: { letterSpacing: 0.6, marginBottom: space.xs },
  row: { gap: 2, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
