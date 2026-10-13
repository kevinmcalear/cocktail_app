import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import type { Fact } from '@/components/screens/drink/DrinkFacts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, space } from '@/constants/tokens';
import { useSwapFor, type IngredientBottle } from '@/hooks/useIngredients';
import { useItemMaker } from '@/hooks/useMakers';
import { usePrepRatio } from '@/hooks/usePrepCard';

import { IngredientMaker } from './IngredientMaker';

type Link = { id: string; name: string };

interface Props {
  ingredient: {
    id?: string;
    bar_id?: string | null;
    name: string;
    ingredient_role?: string | null;
    generic?: Link | null;
    madeFrom?: Link | null;
  };
  bottles: IngredientBottle[];
  /** A house prep: the Kind of row carries its parent's ratio ("1 : 1"). */
  isPrep?: boolean;
  /** More rows from elsewhere (Swap for). */
  extra?: ReactNode;
}

const FIRST = 12;

/** "Carpano · 16.5% · Italy": what's on a bottle's label. */
export function bottleFacts(b: { brand_maker?: string | null; abv?: number | null; origin?: string | null }) {
  return [b.brand_maker?.trim(), b.abv != null ? `${Number(b.abv)}%` : null, b.origin?.trim()].filter(Boolean).join(' · ');
}

/** Strength, From, Maker: a bottle's fact tiles under its description (prep-ing-campari). */
export function useBottleTiles(b: { id: string; ingredient_role?: string | null; brand_maker?: string | null; abv?: number | null; origin?: string | null }): Fact[] {
  const router = useRouter();
  const { data: maker } = useItemMaker(b.ingredient_role === 'product' ? b.id : null);
  if (b.ingredient_role !== 'product') return [];
  return [
    b.abv != null ? { label: 'Strength', value: `${Number(b.abv)}% ABV` } : null,
    b.origin?.trim() ? { label: 'From', value: b.origin.trim() } : null,
    // The maker's tile opens its page, so Around it needn't repeat it (prep-ing-campari).
    maker?.display_name || b.brand_maker?.trim()
      ? { label: 'Maker', value: maker?.display_name || b.brand_maker!.trim(), onPress: maker ? () => router.push(`/p/${maker.handle}` as Href) : undefined, accessibilityHint: maker ? 'Opens the maker' : undefined }
      : null,
  ].filter((f): f is Fact => !!f);
}

/**
 * "Around it" on an ingredient's page: what it's a kind of (with a prep
 * parent's ratio), what a prep is made from, who makes a bottle, what to swap
 * it for, and the bottles you can buy that are a kind of it. Nothing shows
 * when there's nothing to say.
 */
export function AroundIt({ ingredient, bottles: allBottles, isPrep, extra }: Props) {
  const [all, setAll] = useState(false);
  const { data: ratio } = usePrepRatio(isPrep ? ingredient.generic?.id : null);
  const bottle = ingredient.ingredient_role === 'product' && !!ingredient.id;
  const { data: swaps = [] } = useSwapFor(bottle ? ingredient.id! : null, ingredient.generic?.id);
  // A prep's Around it is what it's a kind of, and nothing else (prep-prep-phone).
  const bottles = isPrep ? [] : allBottles;
  if (!bottle && !ingredient.generic && !ingredient.madeFrom && !bottles.length && !extra) return null;
  const shown = all ? bottles : bottles.slice(0, FIRST);

  return (
    <View style={styles.section}>
      <Headline role="heading">Around it</Headline>
      <View>
        {ingredient.generic ? <LinkRow lead="Kind of" item={ingredient.generic} value={ratio ?? undefined} /> : null}
        {ingredient.madeFrom ? <LinkRow lead="Made from" item={ingredient.madeFrom} /> : null}
        {swaps.length && ingredient.generic ? <LinkRow lead="Swap for" item={{ id: ingredient.generic.id, name: swaps.map((x) => x.name).join(', ') }} /> : null}
        {extra}
        {bottle ? <IngredientMaker item={{ id: ingredient.id!, bar_id: ingredient.bar_id ?? null }} editOnly /> : null}
      </View>
      {bottles.length ? (
        <View role="group" aria-label={`Bottles of ${ingredient.name}`} style={styles.list}>
          <Body>Bottles</Body>
          {shown.map((b) => (
            <LinkRow key={b.id} item={b} detail={bottleFacts(b)} />
          ))}
          {bottles.length > FIRST ? <Button label={all ? 'Show fewer' : `Show all ${bottles.length}`} variant="secondary" onPress={() => setAll(!all)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** A row in Around it: a lead ("Kind of"), the name, an optional value ("1 : 1") and a chevron. */
export function LinkRow({ lead, item, detail, value, onPress }: { lead?: string; item: Link; detail?: string; value?: string; onPress?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${lead ? `${lead} ` : ''}${item.name}${value ? `, ${value}` : ''}, open`}
      onPress={onPress ?? (() => router.push(`/ingredient/${item.id}`))}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      {lead ? (
        <Caption tone="muted" style={styles.lead}>
          {lead}
        </Caption>
      ) : null}
      <View style={styles.rowName}>
        <Body numberOfLines={2}>{item.name}</Body>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      {value ? (
        <Caption tone="muted" style={styles.value}>
          {value}
        </Caption>
      ) : null}
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  list: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  lead: { width: 72 },
  rowName: { flex: 1 },
  value: { fontFamily: fontFamilies.mono },
});
