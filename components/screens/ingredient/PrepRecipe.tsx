import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Chip, Headline, SpecRow, useDs } from '@/components/ds';
import { Choice } from '@/components/screens/batch/BatchParts';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { partsRatio, prepParts, sizeOptions } from '@/lib/prepParts';
import { toQuantity } from '@/lib/quantity';
import { scaledYield, scaleRecipe, type RecipeLine } from '@/lib/scale';

export interface PrepLine extends RecipeLine {
  ingredientId: string | null;
  note: string | null;
  optional: boolean;
  houseMade: boolean;
}

interface PrepRecipeProps {
  lines: PrepLine[];
  yieldAmount: number | null;
  yieldUnit: string | null;
}

const VIEWS = [
  { value: 'parts', label: 'Parts' },
  { value: 'amounts', label: 'Amounts' },
] as const;

/**
 * A prep's recipe on its page: as parts when it reads as a ratio, or as amounts
 * scaled to a batch, half, double or a bottle. Scaling here never changes the
 * saved recipe.
 */
export function PrepRecipe({ lines, yieldAmount, yieldUnit }: PrepRecipeProps) {
  const ds = useDs();
  const router = useRouter();
  const parts = prepParts(lines);
  const [view, setView] = useState<'parts' | 'amounts'>('amounts');
  const sizes = sizeOptions(yieldAmount, yieldUnit);
  const [sizeKey, setSizeKey] = useState('batch');
  const size = sizes.find((s) => s.key === sizeKey) ?? sizes[0];
  const showParts = view === 'parts' && !!parts;
  const scaled = scaleRecipe(lines, size.factor);
  const ratio = partsRatio(parts);
  const makes = scaledYield(yieldAmount, yieldUnit, size.factor);
  const byWeight = lines.every((l) => toQuantity(l.amount, l.unit)?.kind !== 'ml');
  const shares = lines.map((l) => toQuantity(l.amount, l.unit)).map((q) => (q && q.kind !== 'count' ? q.value : 0));
  const measured = shares.filter((s) => s > 0).length >= 2;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Headline role="heading">Recipe</Headline>
          {ratio ? <Caption tone="muted">{`${ratio}${byWeight ? ' by weight' : ''}`}</Caption> : null}
        </View>
        {parts ? <Choice label="Show the recipe as" options={VIEWS} value={view} onChange={setView} /> : null}
      </View>
      {showParts ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizes}>
          {sizes.map((s) => (
            <Chip key={s.key} label={s.label} selected={s.key === size.key} onPress={() => setSizeKey(s.key)} accessibilityLabel={`Show amounts for ${s.label}`} />
          ))}
        </ScrollView>
      )}
      {measured ? (
        <View style={styles.ratio} aria-hidden>
          {shares.map((s, i) =>
            s > 0 ? <View key={lines[i].id} style={{ flex: s, backgroundColor: withAlpha(ds.accentText, Math.max(0.25, 1 - i * 0.22)) }} /> : null,
          )}
        </View>
      ) : null}
      <View>
        {lines.map((l, i) => (
          <SpecRow
            key={l.id}
            amount={showParts ? parts![i] : scaled[i].scaled}
            alignAmount
            ingredient={l.name}
            ingredientId={l.ingredientId}
            houseMade={l.houseMade}
            optional={l.optional}
            note={l.note ?? undefined}
            onPress={l.ingredientId ? () => router.push(`/ingredient/${l.ingredientId}` as never) : undefined}
          />
        ))}
      </View>
      {makes && !showParts ? <Caption tone="muted">{`Makes about ${makes}`}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  title: { gap: 2 },
  sizes: { gap: space.sm },
  ratio: { flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
});
