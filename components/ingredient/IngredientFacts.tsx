import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Surface, useDs } from '@/components/ds';
import { TechnicalIngredientCard } from '@/components/techniques/TechnicalIngredientCard';
import { layout, space } from '@/constants/tokens';
import type { IngredientBottle } from '@/hooks/useIngredients';

type Link = { id: string; name: string };

interface Props {
  ingredient: {
    name: string;
    ingredient_role?: string | null;
    brand_maker?: string | null;
    abv?: number | null;
    origin?: string | null;
    generic?: Link | null;
    madeFrom?: Link | null;
  };
  bottles: IngredientBottle[];
}

const FIRST = 12;

/** "Carpano · 16.5% · Italy": what's on a bottle's label. */
export function bottleFacts(b: { brand_maker?: string | null; abv?: number | null; origin?: string | null }) {
  return [b.brand_maker?.trim(), b.abv != null ? `${Number(b.abv)}%` : null, b.origin?.trim()].filter(Boolean).join(' · ');
}

const ROLE_TITLE: Record<string, string> = { product: 'Bottle', prep: 'Made in house', generic: 'Style' };

/**
 * On an ingredient's page: what it is (a bottle, a house prep, a style), what
 * it's a kind of, the bottle a prep is made from, and the bottles you can buy
 * that are a kind of it; for a technical one (xanthan, agar), how to use it.
 * Nothing shows when there's nothing to say.
 */
export function IngredientFacts(props: Props) {
  return (
    <>
      <Facts {...props} />
      <TechnicalIngredientCard name={props.ingredient.name} />
    </>
  );
}

function Facts({ ingredient, bottles }: Props) {
  const [all, setAll] = useState(false);
  const role = ingredient.ingredient_role ?? null;
  const facts = role === 'product' ? bottleFacts(ingredient) : '';
  if (!role && !ingredient.generic && !ingredient.madeFrom && !bottles.length) return null;
  const shown = all ? bottles : bottles.slice(0, FIRST);

  return (
    <Surface style={styles.stack}>
      {role ? (
        <View style={styles.head}>
          <Headline>{ROLE_TITLE[role]}</Headline>
          {facts ? <Caption tone="muted">{facts}</Caption> : null}
        </View>
      ) : null}
      {ingredient.madeFrom ? <LinkRow lead="Made from" item={ingredient.madeFrom} /> : null}
      {ingredient.generic ? <LinkRow lead="A kind of" item={ingredient.generic} /> : null}
      {bottles.length ? (
        <View role="group" aria-label={`Bottles of ${ingredient.name}`} style={styles.list}>
          <Body>Bottles</Body>
          {shown.map((b) => (
            <LinkRow key={b.id} item={b} detail={bottleFacts(b)} />
          ))}
          {bottles.length > FIRST ? (
            <Button
              label={all ? 'Show fewer' : `Show all ${bottles.length}`}
              variant="secondary"
              onPress={() => setAll(!all)}
            />
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}

function LinkRow({ lead, item, detail }: { lead?: string; item: Link; detail?: string }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${lead ? `${lead} ` : ''}${item.name}, open`}
      onPress={() => router.push(`/ingredient/${item.id}`)}
      style={[styles.row, { borderTopColor: ds.c.line }]}
    >
      {lead ? <Caption tone="muted">{lead}</Caption> : null}
      <Body numberOfLines={1} style={styles.rowName}>
        {item.name}
      </Body>
      {detail ? <Caption tone="muted">{detail}</Caption> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  head: { gap: space.xs },
  list: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.minTapTarget,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1 },
});
