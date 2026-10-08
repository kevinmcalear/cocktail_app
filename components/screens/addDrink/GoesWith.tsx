import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Surface, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { usePairings } from '@/hooks/usePairings';
import { balanceOf } from '@/lib/balance';
import { type WizardLine, type WizardPick } from '@/lib/drinkWizard';

import { PairChip } from '../pairings/PairChip';
import { Eyebrow } from './WizardChrome';

type Ingredient = { id: string; name: string | null; generic_id?: string | null };

const listNames = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * Once a drink has ingredients, the quick adds become "Goes with": what pairs
 * with everything already in the glass, counted from real drinks. Falls back
 * to `fallback` (the common quick adds) when nothing pairs with all of them.
 */
export function GoesWith({ lines, onAdd, fallback }: { lines: readonly WizardLine[]; onAdd: (pick: WizardPick) => void; fallback: React.ReactNode }) {
  const router = useRouter();
  const known = lines.filter((l): l is WizardLine & { id: string } => !!l.id);
  const { data: pairs = [] } = usePairings(
    known.map((l) => l.id),
    { limit: 10 }
  );
  const fresh = pairs.filter((p) => !lines.some((l) => l.id === p.id)).slice(0, 8);
  if (!known.length || !fresh.length) return <>{fallback}</>;
  const names = known.map((l) => l.name);
  return (
    <View style={styles.stack}>
      <Eyebrow>{`Goes with ${listNames(names)}`}</Eyebrow>
      <View role="group" aria-label="Goes with what's in it" style={styles.chips}>
        {fresh.map((p) => (
          <PairChip
            key={p.id}
            label={p.name}
            add
            onPress={() => onAdd({ id: p.id, name: p.name })}
            accessibilityLabel={`Add ${p.name}. In drinks with ${names.map((n, i) => `${n} ${p.together[i] ?? 0} times`).join(', ')}`}
          />
        ))}
      </View>
      <DsText
        variant="caption"
        tone="accent"
        role="link"
        onPress={() => router.push({ pathname: '/flavor-map', params: { with: known.map((l) => l.id).join(',') } })}
      >
        Explore more on the flavor map
      </DsText>
    </View>
  );
}

/** The drink so far on four meters, with one sentence when something's missing. */
export function BalanceCard({ lines, ingredients }: { lines: readonly WizardLine[]; ingredients: readonly Ingredient[] }) {
  const ds = useDs();
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const balance = balanceOf(
    lines.map((l) => {
      const generic = l.id ? byId.get(byId.get(l.id)?.generic_id ?? '') : null;
      const n = parseFloat(l.amount.replace(',', '.'));
      return { name: l.name, genericName: generic?.name ?? null, amount: Number.isFinite(n) ? n : null, unit: l.unit || null };
    })
  );
  if (!balance) return null;
  const meters: [string, number][] = [
    ['Strong', balance.strong],
    ['Sour', balance.sour],
    ['Sweet', balance.sweet],
    ['Bitter', balance.bitter],
  ];
  return (
    <Surface raised style={styles.balance}>
      <View role="list" aria-label="How it balances">
        {meters.map(([label, v]) => (
          <View key={label} role="listitem" aria-label={`${label}: ${Math.round(v * 100)} of 100`} style={styles.meterRow}>
            <Caption tone="muted" style={styles.meterLabel}>
              {label}
            </Caption>
            <View style={[styles.track, { backgroundColor: ds.c.line }]}>
              <View style={[styles.fill, { width: `${Math.max(2, Math.round(v * 100))}%`, backgroundColor: ds.c.ink }]} />
            </View>
          </View>
        ))}
      </View>
      {balance.hint ? <Caption>{balance.hint}</Caption> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  balance: { gap: space.md, padding: space.lg },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: space.xl },
  meterLabel: { width: space.xxxl + space.lg },
  track: { flex: 1, height: space.xs, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
