import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, Field, PressableScale, useDs } from '@/components/ds';
import { PickList } from '@/components/search/NearPicks';
import { radius, space } from '@/constants/tokens';
import { useCloseClassics, type CloseClassic } from '@/hooks/useClosestClassic';
import { useDrinkLists } from '@/hooks/useDiscover';
import { suggestClassic } from '@/lib/classics';
import { searchByName, type StepProps } from '@/lib/drinkWizard';
import { nearAfter } from '@/lib/nearName';

import type { CatalogIngredient } from './IngredientSearch';
import { Eyebrow } from './WizardChrome';

/**
 * "Is it a riff on one of these?" (board w2-wizard-steps, Q25, A): up to four
 * classics sharing the most with the spec, each with its drawing and what it
 * shares, then Find another classic, then It's an original. Before there's a
 * spec, the classic its name says. Skip leaves it an original.
 */
export function RiffPick({ draft, set, ingredients }: StepProps & { ingredients: readonly CatalogIngredient[] }) {
  const classics = useDrinkLists().data ?? [];
  const [riff, setRiff] = useState('');
  // Pressed It's an original: ticked, so the tap shows (nothing to save, no riff is an original).
  const [original, setOriginal] = useState(false);
  const generic = (id: string) => ingredients.find((i) => i.id === id)?.generic_id ?? null;
  const close = useCloseClassics(draft.lines.flatMap((l) => (l.id ? [{ id: l.id, generic: generic(l.id) }] : []))).data ?? [];
  const byName = draft.name.trim() ? suggestClassic(draft.name, classics)?.classic : undefined;
  const card = (c: { id: string; name: string }): CloseClassic => ({ id: c.id, name: c.name, imageUrl: classics.find((x) => x.id === c.id)?.imageUrl ?? null, glass: null, shares: [] });
  const offered = close.length ? close : byName ? [card(byName)] : [];
  // A classic found by search shows as a card too, first, picked.
  const picked = draft.riffOf?.id && !offered.some((c) => c.id === draft.riffOf?.id) ? card({ id: draft.riffOf.id, name: draft.riffOf.name }) : null;
  const cards = picked ? [picked, ...offered.slice(0, 3)] : offered;
  const results = searchByName(riff, classics, 5);
  // "negorni": Negroni, under "Did you mean".
  const near = nearAfter(riff, classics, results, (c) => c.name);
  const pick = (c: { id: string; name: string } | null) => {
    setOriginal(!c);
    set({ riffOf: c ? { id: c.id, name: c.name } : null });
  };
  const title = cards.length ? 'Is it a riff on one of these?' : 'Riff on a classic?';
  return (
    <View style={styles.section}>
      <Eyebrow>{title}</Eyebrow>
      {cards.length ? (
        <View role="radiogroup" accessibilityLabel={title} style={styles.grid}>
          {cards.map((c) => (
            <RiffCard key={c.id} classic={c} on={draft.riffOf?.id === c.id} onPress={() => pick(c)} />
          ))}
        </View>
      ) : null}
      <Field label={cards.length ? 'Find another classic' : 'Find a classic'} value={riff} onChangeText={setRiff} placeholder="Negroni, Daiquiri…" autoCorrect={false} maxLength={60} />
      {riff.trim() ? (
        <PickList
          rows={[...results.map((c) => ({ id: c.id, label: c.name })), ...near.map((c) => ({ id: c.id, label: c.name, near: true }))]}
          empty="No classic by that name."
          onPick={(id) => {
            const c = classics.find((x) => x.id === id);
            if (c) pick(c);
            setRiff('');
          }}
        />
      ) : null}
      <Button label="It’s an original" variant="secondary" icon={original && !draft.riffOf ? 'checkmark' : undefined} onPress={() => pick(null)} />
    </View>
  );
}

/** A classic on paper, its name, and "Shares mezcal, lime, agave"; ringed in the accent when picked. */
function RiffCard({ classic, on, onPress }: { classic: CloseClassic; on: boolean; onPress: () => void }) {
  const ds = useDs();
  const shares = classic.shares.length ? `Shares ${classic.shares.join(', ')}` : null;
  return (
    <PressableScale
      role="radio"
      aria-checked={on}
      accessibilityLabel={shares ? `${classic.name}, ${shares.toLowerCase()}` : classic.name}
      onPress={onPress}
      style={[styles.card, { borderColor: on ? ds.accentText : ds.c.line, backgroundColor: on ? ds.c.raised : ds.c.surface }]}
    >
      <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
        <DrinkImage source={classic.imageUrl} itemId={classic.id} glass={classic.glass} thumb sketchDetail="thumb" radius={0} accessibilityLabel={classic.name} style={styles.pic} />
      </View>
      <Body numberOfLines={2}>{classic.name}</Body>
      {shares ? (
        <Caption tone="muted" numberOfLines={2}>
          {shares}
        </Caption>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  // Two to a row, as the board draws them.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 2 },
  card: { flexBasis: '45%', flexGrow: 1, maxWidth: '50%', minWidth: 0, gap: space.sm, padding: space.sm + 2, borderRadius: radius.card, borderWidth: 1.5 },
  paper: { height: 96, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  pic: { width: 88, height: 88 },
});
