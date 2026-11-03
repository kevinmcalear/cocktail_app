import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, DsText } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useClosestClassic } from '@/hooks/useClosestClassic';
import { usePairings } from '@/hooks/usePairings';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { balanceOf, fixesFor } from '@/lib/balance';
import { withArticle, type SpecIngredient } from '@/lib/closestClassic';
import { amountOf, type WizardLine, type WizardPick } from '@/lib/drinkWizard';

import { Prompt } from './Prompt';

type Ingredient = { id: string; name: string | null; generic_id?: string | null };

const listNames = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * Once a drink has ingredients, the quick adds become "Goes with": what pairs
 * with everything already in the glass, counted from real drinks. Falls back
 * to `fallback` (the common quick adds) when nothing pairs with all of them.
 * `after` (the classic it's close to) sits under the chips.
 */
export function GoesWith({ lines, onAdd, fallback, after, away, onAway }: { lines: readonly WizardLine[]; onAdd: (pick: WizardPick) => void; fallback: ReactNode; after?: ReactNode; /** Put away for this draft (draft.putAway). */ away?: boolean; onAway?: () => void }) {
  const router = useRouter();
  const flavorMap = useVenueFeature('flavorMap');
  const known = lines.filter((l): l is WizardLine & { id: string } => !!l.id);
  const { data: pairs = [] } = usePairings(
    known.map((l) => l.id),
    { limit: 10 }
  );
  const fresh = pairs.filter((p) => !lines.some((l) => l.id === p.id)).slice(0, 8);
  if (!known.length || !fresh.length || away) {
    return (
      <>
        {away ? null : fallback}
        {after}
      </>
    );
  }
  const names = known.map((l) => l.name);
  return (
    <View style={styles.stack}>
      <Prompt
        icon="leaf.fill"
        title={`Goes with ${listNames(names)}`}
        body="From real drinks that use them."
        onDismiss={onAway}
        chips={fresh.map((p) => ({ label: p.name, onPress: () => onAdd({ id: p.id, name: p.name }), accessibilityLabel: `Add ${p.name}. In drinks with ${names.map((n, i) => `${n} ${p.together[i] ?? 0} times`).join(', ')}` }))}
      >
        {flavorMap ? (
          <DsText
            variant="caption"
            tone="accent"
            role="link"
            style={styles.more}
            onPress={() => router.push({ pathname: '/flavor-map', params: { with: known.map((l) => l.id).join(',') } })}
          >
            Explore more on the flavor map
          </DsText>
        ) : null}
      </Prompt>
      {after}
    </View>
  );
}

/**
 * "Close to a Mezcal Margarita. Make it a riff?": the catalog classic the
 * spec is closest to by what goes in (ids, then generics). The riff
 * is picked up again on Credits.
 */
export function CloseToClassic({ ingredients, riffOf, onRiff }: { ingredients: readonly SpecIngredient[]; riffOf: WizardPick | null; onRiff: (classic: WizardPick) => void }) {
  const { data: classic } = useClosestClassic(ingredients);
  const [no, setNo] = useState<string | null>(null);
  if (!classic || no === classic.id) return null;
  const close = `Close to ${withArticle(classic.name)}.`;
  if (riffOf?.id === classic.id) return <Body tone="muted">{`${close} It’s down as a riff on it.`}</Body>;
  return (
    <Prompt
      icon="arrow.left.and.right"
      title={`${close} Make it a riff?`}
      body={`The ${classic.name}’s page will list it.`}
      actions={[
        { label: `Riff on the ${classic.name}`, onPress: () => onRiff(classic) },
        { label: 'No', onPress: () => setNo(classic.id) },
      ]}
    />
  );
}

/**
 * "Sour with nothing sweet." (Kept-add-helpers, Balance): when the spec so far
 * is missing something, one amber line and the one-tap fixes for it ("+ Agave
 * syrup" for a sour mezcal drink). The taste meters are the desktop rail's.
 */
export function BalanceCard({ lines, ingredients, onAdd, away, onAway }: { lines: readonly WizardLine[]; ingredients: readonly Ingredient[]; onAdd?: (name: string) => void; away?: readonly string[]; onAway?: (prompt: string) => void }) {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const parts = lines.map((l) => {
    const generic = l.id ? byId.get(byId.get(l.id)?.generic_id ?? '') : null;
    return { name: l.name, genericName: generic?.name ?? null, amount: amountOf(l.amount), unit: l.unit || null };
  });
  const balance = balanceOf(parts);
  // Put away, what it said stays away; a new gap still shows.
  if (!balance?.hint || away?.includes(balance.hint)) return null;
  const hint = balance.hint;
  const fixes = balance.need && onAdd ? fixesFor(balance.need, parts) : [];
  // "Sour with nothing sweet." then the reason.
  const [title, ...rest] = hint.split(/(?<=\.) /);
  return <Prompt warn icon="exclamationmark.triangle" title={title} body={rest.join(' ')} onDismiss={onAway ? () => onAway(hint) : undefined} chips={fixes.map((name) => ({ label: name, onPress: () => onAdd?.(name), accessibilityLabel: `Add ${name} to balance it` }))} />;
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  more: { paddingLeft: 20 + space.md },
});
