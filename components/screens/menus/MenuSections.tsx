import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Headline, PressableScale, Spec, useDs } from '@/components/ds';
import { displayFaces, fontFamilies, space } from '@/constants/tokens';
import { drinkIdFromHref, itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { formatPrice } from '@/lib/menus';
import type { MenuDrink, MenuSectionDetail } from '@/types/menus';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

const CATEGORY: Record<MenuDrink['kind'], ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/** Where the guest card puts each drink's picture. */
export type CardPictures = 'above' | 'beside' | 'none';

/** A drink with no photo of its own, or only a generated one: it shows a drawing. */
const isDrawn = (d: MenuDrink) => !d.imageUrl || d.isSketch;

/**
 * The drink's picture beside its line on the page. Decorative: the line says
 * what it is. Only a drink with a real id (one that opens, or any drink on
 * your own guest card) can be drawn as a sketch.
 */
function DrinkThumb({ drink, drawable, size = 56 }: { drink: MenuDrink; drawable: boolean; size?: number }) {
  return (
    <View style={{ width: size }} aria-hidden>
      <DrinkImage
        thumb
        sketchDetail={size < 140 ? 'thumb' : undefined}
        source={drink.imageUrl}
        generated={drink.isSketch}
        glass={drink.glass}
        itemId={drawable ? drink.id : null}
        accessibilityLabel={drink.name}
        radius="control"
      />
    </View>
  );
}

/** "NEW" in the accent, after the name of a drink new on this menu. */
function NewMark() {
  const ds = useDs();
  return (
    <Caption color={ds.accentText} style={styles.mono} aria-label="new">
      NEW
    </Caption>
  );
}

/**
 * The name, its price and its line, the name in the venue's display face. On
 * a page row the price sits at the row's end instead (the row draws it).
 */
function DrinkLine({ drink, centered, card = false, isNew = false }: { drink: MenuDrink; centered: boolean; card?: boolean | 'compact'; isNew?: boolean }) {
  const ds = useDs();
  const price = card ? formatPrice(drink.price) : null;
  return (
    <View style={centered ? styles.centered : styles.flex}>
      <View style={[styles.nameRow, centered && styles.nameRowCentered]}>
        {card ? (
          <DsText
            variant={card === 'compact' ? 'headline' : 'title'}
            align={centered ? 'center' : undefined}
            style={[centered ? undefined : styles.flex, card === 'compact' && { fontFamily: displayFaces[ds.displayFace].regular }]}
          >
            {drink.name}
          </DsText>
        ) : (
          <Headline numberOfLines={2} style={[styles.shrink, { fontFamily: displayFaces[ds.displayFace].regular }]}>
            {drink.name}
          </Headline>
        )}
        {isNew ? <NewMark /> : null}
        {price ? <Spec>{price}</Spec> : null}
      </View>
      {drink.line ? (
        <Caption tone="muted" align={centered ? 'center' : undefined}>
          {drink.line}
        </Caption>
      ) : null}
    </View>
  );
}

interface MenuSectionsProps {
  sections: Pick<MenuSectionDetail, 'id' | 'name' | 'drinks'>[];
  variant: 'page' | 'card';
  /** Where a `page` row opens; null leaves the row still. Default: the drink's own page. */
  hrefFor?: (drink: MenuDrink) => string | null;
  /** On the `card`: each drink's picture above its name (two across), beside it, or none. */
  pictures?: CardPictures;
  /** The card at preview size: smaller pictures and names. */
  compact?: boolean;
  /** Page rows: drinks new on this menu, marked NEW. */
  newIds?: ReadonlySet<string>;
}

/** A page row's price, in mono at the row's end. */
function RowPrice({ drink }: { drink: MenuDrink }) {
  const price = formatPrice(drink.price);
  return price ? <Spec>{price}</Spec> : null;
}

/**
 * A menu's sections, set like the printed menu. `page`: rows with each
 * drink's picture that open it. `card`: still, for the guest card and print,
 * with each drink's photo or sketch unless `pictures` is 'none'. The card is
 * your own menu, so every drink on it has a real id to draw from.
 */
export function MenuSections({ sections, variant, hrefFor, pictures = 'above', compact = false, newIds }: MenuSectionsProps) {
  const ds = useDs();
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const card = variant === 'card';
  const href = (d: MenuDrink) => (card ? null : hrefFor ? hrefFor(d) : itemHref(CATEGORY[d.kind], d.id));
  const grid = card && pictures === 'above';
  const drawn = card && pictures !== 'none' && sections.some((s) => s.drinks.some(isDrawn));
  return (
    <View style={styles.sections}>
      {sections
        .filter((s) => s.drinks.length > 0)
        .map((s) => (
          <View key={s.id} style={styles.section}>
            <View style={[styles.sectionHead, card && styles.sectionHeadCentered]}>
              <Caption tone="muted" role="heading" style={[styles.sectionTitle, !card && styles.mono]}>
                {s.name.toUpperCase()}
              </Caption>
              {card ? null : (
                <Caption tone="muted" style={styles.mono}>
                  {s.drinks.length}
                </Caption>
              )}
            </View>
            {grid ? (
              <View style={styles.cardGrid}>
                {s.drinks.map((d) => (
                  <View key={d.id} style={styles.cardTile}>
                    <DrinkThumb drink={d} drawable size={compact ? 96 : 144} />
                    <DrinkLine drink={d} centered card={compact ? 'compact' : true} />
                  </View>
                ))}
              </View>
            ) : s.drinks.map((d) => {
              const to = href(d);
              if (card && pictures === 'beside') {
                return (
                  <View key={d.id} style={[styles.row, styles.cardBeside]}>
                    <DrinkThumb drink={d} drawable size={compact ? 56 : 88} />
                    <DrinkLine drink={d} centered={false} card={compact ? 'compact' : true} />
                  </View>
                );
              }
              if (!to) {
                return (
                  <View key={d.id} style={card ? styles.cardRow : [styles.row, { borderBottomColor: ds.c.line }]}>
                    {card ? null : <DrinkThumb drink={d} drawable={false} />}
                    <DrinkLine drink={d} centered={card} card={card} isNew={!card && !!newIds?.has(d.id)} />
                    {card ? null : <RowPrice drink={d} />}
                  </View>
                );
              }
              return (
                <PressableScale
                  key={d.id}
                  role="link"
                  accessibilityLabel={[d.name, newIds?.has(d.id) ? 'new' : null, formatPrice(d.price), d.line].filter(Boolean).join(', ')}
                  onPressIn={() => {
                    const id = drinkIdFromHref(to);
                    if (id) prefetch(id, { name: d.name, imageUrl: d.isSketch ? null : d.imageUrl });
                  }}
                  onPress={() => router.push(to as never)}
                  style={[styles.row, { borderBottomColor: ds.c.line }]}
                >
                  <DrinkThumb drink={d} drawable />
                  <DrinkLine drink={d} centered={false} isNew={!!newIds?.has(d.id)} />
                  <RowPrice drink={d} />
                </PressableScale>
              );
            })}
          </View>
        ))}
      {drawn ? (
        // One note for the whole card, and no tag: drawings are obviously drawings.
        <View style={styles.drawnNote}>
          <Caption tone="muted">Drawn from each drink’s spec until it has a photo</Caption>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  section: { gap: space.xs },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeadCentered: { justifyContent: 'center' },
  sectionTitle: { letterSpacing: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  cardRow: { paddingVertical: space.xs },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: space.xl, paddingTop: space.sm },
  // Two across, even on a phone; one alone sits in the middle.
  cardTile: { flexBasis: '50%', minWidth: 120, flexGrow: 0, alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm },
  cardBeside: { borderBottomWidth: 0, paddingVertical: space.sm },
  drawnNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  mono: { fontFamily: fontFamilies.mono },
  centered: { alignItems: 'center', gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  nameRowCentered: { justifyContent: 'center', flexWrap: 'wrap' },
});
