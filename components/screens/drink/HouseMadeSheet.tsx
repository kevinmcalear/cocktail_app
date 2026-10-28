import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, IngredientThumb, Sheet, Spec, useDs, useSheetClose } from '@/components/ds';
import { fontFamilies, radius, space, type } from '@/constants/tokens';
import { useIngredient } from '@/hooks/useIngredients';
import { useItemPrep } from '@/hooks/usePrepCard';
import { keepsFor } from '@/lib/batchPrep';
import { lineAmount } from '@/lib/drinkMath';
import { leadLine, servesPerBatch } from '@/lib/houseMade';
import { specLines, type PresentationRecipe, type SpecLine } from '@/lib/spec';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * A house-made spec line, opened in place (board drink-sheet-housemade): what
 * it is, how much this drink takes, how many a batch makes, how long it keeps,
 * its recipe in the unit the spec reads in (Eddie, 27 Oct) and when to start
 * it, then its page or Make it.
 */
export function HouseMadeSheet({ line, onClose }: { line: SpecLine; onClose: () => void }) {
  return (
    <Sheet visible onClose={onClose} accessibilityLabel={line.ingredient ?? 'House-made'} ground>
      <HouseMadeBody line={line} />
    </Sheet>
  );
}

function HouseMadeBody({ line }: { line: SpecLine }) {
  const ds = useDs();
  const router = useRouter();
  const close = useSheetClose();
  const id = line.ingredientId;
  const { data } = useIngredient(id ?? undefined);
  const { data: card } = useItemPrep(id);
  const ingredient = data?.ingredient as { name?: string; brand_maker?: string | null; generic?: { name: string } | null } | undefined;
  const prep = card?.prep ?? null;
  // The spec's own unit switch: read in ml on the drink, read in ml here. Weighed
  // lines stay in grams: 900 g of sugar is not 900 ml.
  const unit = useSettingsStore((s) => s.specUnit);
  const recipe = specLines(data?.recipe as PresentationRecipe[] | undefined);
  const recipeAmount = (r: SpecLine) => (/^k?g$/i.test(r.unit ?? '') ? r.amount : lineAmount(r, unit));
  const batch = servesPerBatch(prep?.yield_amount ?? null, prep?.yield_unit ?? null, line.ml);
  const keeps = keepsFor(prep?.shelf_life_hours);
  const lead = leadLine(prep?.lead_time_minutes);
  const kind = [ingredient?.generic?.name, ingredient?.brand_maker ? `by ${ingredient.brand_maker}` : null].filter(Boolean).join(' · ');
  const go = (href: Href) => {
    close();
    router.push(href);
  };
  const facts = [
    line.amount ? { label: 'This drink', value: lineAmount(line, unit) ?? line.amount } : null,
    batch ? { label: 'A batch is', value: `About ${batch}` } : null,
    keeps ? { label: 'Keeps', value: keeps.replace(/^keeps /, '') } : null,
  ].filter((f): f is { label: string; value: string } => !!f);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.head}>
        <View style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
          <IngredientThumb id={id} name={line.ingredient ?? ''} size={56} />
        </View>
        <View style={styles.flex}>
          <Headline role="heading">{line.ingredient}</Headline>
          {kind ? <Caption tone="muted">{kind}</Caption> : <Caption tone="muted">House-made</Caption>}
        </View>
      </View>
      {facts.length ? (
        <View style={styles.facts}>
          {facts.map((f) => (
            <View key={f.label} accessible accessibilityLabel={`${f.label}: ${f.value}`} style={[styles.fact, { backgroundColor: ds.c.surface }]}>
              <Caption tone="muted" numberOfLines={1}>{f.label}</Caption>
              {/* One line each, as drawn: the amount in mono, the rest in the body face. */}
              <DsText variant={f.label === 'This drink' ? 'spec' : 'body'} numberOfLines={1} style={[styles.value, f.label === 'This drink' ? null : styles.medium]}>
                {f.value}
              </DsText>
            </View>
          ))}
        </View>
      ) : null}
      {recipe.length ? (
        <View role="list" accessibilityLabel="Recipe">
          {recipe.map((r) => (
            <View key={r.key} role="listitem" style={[styles.part, { borderBottomColor: ds.c.line }]}>
              <Spec tone="accent" style={styles.amount}>
                {recipeAmount(r) ?? ''}
              </Spec>
              <Body style={styles.flex}>{r.ingredient}</Body>
            </View>
          ))}
        </View>
      ) : (
        <Body tone="muted">No recipe on its card yet.</Body>
      )}
      {lead ? <Caption tone="muted">{lead}</Caption> : null}
      {id ? (
        <View style={styles.actions}>
          <Button label="Open its page" variant="secondary" onPress={() => go(`/ingredient/${id}` as Href)} style={styles.flex} />
          {recipe.length ? <Button label="Make it" onPress={() => go(`/ingredient/${id}/make` as Href)} style={styles.flex} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingTop: space.md, paddingBottom: space.xl, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 64, height: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flex: 1, minWidth: 0, paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.control, gap: 2 },
  value: { fontSize: type.caption.fontSize + 2, lineHeight: type.caption.lineHeight + 2 },
  medium: { fontFamily: fontFamilies.bodyMedium },
  part: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 88 },
  actions: { flexDirection: 'row', gap: space.sm },
});
