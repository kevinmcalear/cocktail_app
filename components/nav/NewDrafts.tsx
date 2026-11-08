import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space } from '@/constants/tokens';
import { useAuth, useUserId } from '@/ctx/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { useMenuSectionPlace } from '@/hooks/useDrinkDesk';
import { EMPTY_BEER_WINE, filledBeerWine } from '@/lib/beerWineWizard';
import type { DrinkKind } from '@/lib/drinkKinds';
import { hasContent, type WizardDraft } from '@/lib/drinkWizard';
import { fileTitle, tally, waitingFor, whenWords } from '@/lib/importReview';
import { recipesToFinish } from '@/lib/prepMath';
import { slotStart } from '@/lib/wizardSlots';
import { beerWinePlace, useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';
import { useBringIn } from '@/store/useBringIn';
import { useDraftSyncStore } from '@/store/useDraftSyncStore';
import { isReviewSlot, useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

/**
 * Pick up where you left off, at the bottom of Add (Prod-add-B): an import
 * left to check here, then each drink started here and not saved, newest
 * first, with the recipes still to finish inside it, then the older editor's
 * drafts. A tap goes straight back to it. Signed in, drinks are kept in the
 * account too (hooks/useDraftSync), so another phone or the web lists them.
 */
export function NewDrafts({ barId, onOpen, onOpenKind, onImport, onDrafts }: { barId: string | null; onOpen: (params: Record<string, string>) => void; /** A beer or wine left for now: its wizard picks up where it was. */ onOpenKind: (kind: DrinkKind) => void; onImport: () => void; onDrafts: () => void }) {
  const kept = useDrinkWizardStore((s) => s.kept);
  const keptBeerWine = useBeerWineWizardStore((s) => s.kept);
  const beerWine = (['beer', 'wine'] as const).flatMap((kind) => {
    const k = keptBeerWine[beerWinePlace(kind, barId)];
    return k && filledBeerWine({ ...EMPTY_BEER_WINE, ...k.draft }) ? [{ kind, name: k.draft.name.trim() }] : [];
  });
  const signedIn = !!useAuth().session;
  const userId = useUserId();
  const seen = useDraftSyncStore((s) => s.seen);
  const older = useDrafts().drafts.length;
  // A big import left to finish here is its own entry, never what a new drink opens (Eddie, 29 Oct).
  const review = useBringIn((s) => waitingFor(s.reviews, userId, barId));
  const [now] = useState(Date.now);
  const place = wizardPlace(barId);
  // An import's drink being checked waits in its review, not here.
  const drafts = Object.entries(kept)
    .filter(([slot, k]) => slotStart(slot).place === place && !isReviewSlot(slot) && hasContent(k.draft))
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
  if (!drafts.length && !beerWine.length && !review && !older) return null;
  const t = review ? tally(review) : null;
  return (
    <View style={styles.list}>
      <Caption tone="muted" role="heading" style={styles.head}>
        Pick up where you left off
      </Caption>
      {review && t ? (
        <PickRow
          icon="doc.text"
          title={fileTitle(review.name)}
          sub={`${t.checked} of ${t.total} checked · ${whenWords(review.updatedAt, now)}`}
          onPress={() => {
            useBringIn.getState().setReviewing(review.id);
            onImport();
          }}
        />
      ) : null}
      {drafts.map(([slot, k]) => (
        <DraftRow key={slot} slot={slot} draft={k.draft} barId={barId} onOpen={onOpen} />
      ))}
      {beerWine.map((b) => (
        <PickRow key={b.kind} icon={b.kind === 'beer' ? 'mug.fill' : 'wineglass'} title={b.name || `Untitled ${b.kind}`} sub={`A ${b.kind}, kept on this phone`} onPress={() => onOpenKind(b.kind)} />
      ))}
      {older ? <PickRow icon="square.on.square" title="Drafts" sub={`${older} from the older editor`} onPress={onDrafts} /> : null}
      {/* Said only once each has reached the account. */}
      {signedIn && drafts.length > 0 && drafts.every(([slot]) => seen.includes(slot)) ? (
        // A beer or wine left for now stays on this phone (its row says so): the account line is the drinks'.
        <Caption tone="muted" style={styles.kept}>{`${beerWine.length ? 'Drinks are kept' : 'Kept'} in your account, so your other phone and the web see them too.`}</Caption>
      ) : null}
    </View>
  );
}

function PickRow({ icon, title, sub, children, onPress }: { icon: IconName; title: string; sub: string; children?: ReactNode; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${title}. ${sub}`} onPress={onPress} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.icon, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name={icon} size={18} color={ds.c.ink} />
      </View>
      <View style={styles.text}>
        <Body numberOfLines={1}>{title}</Body>
        <Caption tone="muted">{sub}</Caption>
        {children}
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

function DraftRow({ slot, draft, barId, onOpen }: { slot: string; draft: WizardDraft; barId: string | null; onOpen: (params: Record<string, string>) => void }) {
  const start = slotStart(slot);
  const menu = useMenuSectionPlace(start.menuSectionId).data?.menu ?? null;
  const title = draft.name.trim() || 'Untitled drink';
  const left = recipesToFinish(draft.lines);
  const open = () =>
    onOpen({
      ...(barId ? { barId } : {}),
      ...(start.menuSectionId ? { menuSectionId: start.menuSectionId } : {}),
      ...(start.name ? { name: start.name } : {}),
      ...(start.from ? { from: start.from } : {}),
    });
  return (
    <PickRow icon="pencil" title={title} sub={[menu, 'A drink, in pencil'].filter(Boolean).join(' · ')} onPress={open}>
      {left.map((r) => (
        <Caption key={`${r.depth}:${r.name}`} tone="accent" style={{ paddingLeft: space.md * r.depth }}>
          {`${r.name} · recipe to finish`}
        </Caption>
      ))}
    </PickRow>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.sm },
  head: { ...font.medium, paddingTop: space.sm, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 32, height: 32, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  kept: { marginTop: space.sm },
});
