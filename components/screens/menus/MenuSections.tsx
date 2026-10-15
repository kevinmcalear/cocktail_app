import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Headline, PressableScale, Spec, useDs } from '@/components/ds';
import { displayFaces, displayName, fontFamilies, space } from '@/constants/tokens';
import { drinkIdFromHref, itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { formatPrice } from '@/lib/menus';
import type { SketchInputs } from '@/lib/sketch/types';
import type { MenuDrink, MenuSectionDetail } from '@/types/menus';
import { usePrefetchCocktail } from '@/hooks/useCocktails';
import { siteOrigin } from '@/lib/venueLink';

import { DrinkCode } from './DrinkCode';

const CATEGORY: Record<MenuDrink['kind'], ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/** Where the guest card puts each drink's picture. */
export type CardPictures = 'above' | 'beside' | 'none';

/** A drink with no photo of its own, or only a generated one: it shows a drawing. */
export const isDrawn = (d: MenuDrink) => !d.imageUrl || d.isSketch;

/**
 * The drink's picture beside its line on the page. Decorative: the line says
 * what it is. Only a drink with a real id (one that opens, or any drink on
 * your own guest card) can be drawn as a sketch.
 */
function DrinkThumb({ drink, drawable, size = 56, sketch }: { drink: MenuDrink; drawable: boolean; size?: number; sketch?: SketchInputs | null }) {
  return (
    <View style={{ width: size }} aria-hidden>
      <DrinkImage
        thumb
        sketchDetail={size < 140 ? 'thumb' : undefined}
        source={drink.imageUrl}
        generated={drink.isSketch}
        glass={drink.glass}
        itemId={drawable ? drink.id : null}
        sketch={sketch}
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
function DrinkLine({ drink, centered, card = false, isNew = false, code = false }: { drink: MenuDrink; centered: boolean; card?: boolean | 'compact'; isNew?: boolean; code?: boolean }) {
  const ds = useDs();
  const price = card ? formatPrice(drink.price) : null;
  const url = code ? `${siteOrigin()}${menuDrinkHref(drink)}` : null;
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
          <Headline numberOfLines={2} style={[styles.shrink, displayName.row, { fontFamily: displayFaces[ds.displayFace].regular }]}>
            {drink.name}
          </Headline>
        )}
        {isNew ? <NewMark /> : null}
      </View>
      {drink.line ? (
        <Caption tone="muted" align={centered ? 'center' : undefined}>
          {drink.line}
        </Caption>
      ) : null}
      {/* The guest card's price sits under the line, beside the code that opens the drink. */}
      {url ? (
        <View style={styles.codeRow}>
          {price ? <Spec color={ds.c.sketchInk}>{price}</Spec> : null}
          <DrinkCode url={url} label={`QR code: opens ${drink.name}`} />
        </View>
      ) : price ? (
        <Spec align={centered ? 'center' : undefined}>{price}</Spec>
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
  /** Drinks new on this menu, marked NEW (on the card, not made yet, so not drawn). */
  newIds?: ReadonlySet<string>;
  /** The printed card: a QR code under each drink that opens its page. */
  codes?: boolean;
  /** The printed card's foot: beside the drawings note, at the right ("Scan a code ..."). */
  foot?: ReactNode;
}

/** A page row's price, in mono at the row's end. */
function RowPrice({ drink }: { drink: MenuDrink }) {
  const price = formatPrice(drink.price);
  return price ? <Spec>{price}</Spec> : null;
}

/** A section's name, small in capitals, with how many drinks it has on the page. Centred, with no count, on the card. */
export function SectionHead({ name, count }: { name: string; count: number | null }) {
  const page = count !== null;
  return (
    <View style={[styles.sectionHead, !page && styles.sectionHeadCentered]}>
      <Caption tone="muted" role="heading" style={[styles.sectionTitle, page && styles.mono]}>
        {name.toUpperCase()}
      </Caption>
      {page ? (
        <Caption tone="muted" style={styles.mono}>
          {count}
        </Caption>
      ) : null}
    </View>
  );
}

/** Where a page row opens by default: the drink's own page. */
export const menuDrinkHref = (d: MenuDrink) => itemHref(CATEGORY[d.kind], d.id);

/**
 * A drink's row on a menu page: its picture, its line and price, opening `href` (still when null).
 * `sketch`: a still row's drawing inputs, for a bundled sample drink with no id to draw from.
 */
export function MenuDrinkRow({ drink: d, href, isNew = false, sketch }: { drink: MenuDrink; href: string | null; isNew?: boolean; sketch?: SketchInputs | null }) {
  const ds = useDs();
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  if (!href) {
    return (
      <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
        <DrinkThumb drink={d} drawable={false} sketch={sketch} />
        <DrinkLine drink={d} centered={false} isNew={isNew} />
        <RowPrice drink={d} />
      </View>
    );
  }
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[d.name, isNew ? 'new' : null, formatPrice(d.price), d.line].filter(Boolean).join(', ')}
      onPressIn={() => {
        const id = drinkIdFromHref(href);
        if (id) prefetch(id, { name: d.name, imageUrl: d.isSketch ? null : d.imageUrl });
      }}
      onPress={() => router.push(href as never)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <DrinkThumb drink={d} drawable />
      <DrinkLine drink={d} centered={false} isNew={isNew} />
      <RowPrice drink={d} />
    </PressableScale>
  );
}

/** A menu page's list, flattened for a FlatList: each section's head, then its rows. */
export type MenuPageRow = { key: string; head: string; count: number; first: boolean } | { key: string; drink: MenuDrink };
export function menuPageRows(sections: Pick<MenuSectionDetail, 'id' | 'name' | 'drinks'>[], prefix = ''): MenuPageRow[] {
  return sections
    .filter((s) => s.drinks.length > 0)
    .flatMap((s, i) => [{ key: `${prefix}s-${s.id}`, head: s.name, count: s.drinks.length, first: i === 0 }, ...s.drinks.map((d) => ({ key: `${prefix}${s.id}-${d.id}`, drink: d }))]);
}

/** One `menuPageRows` row, spaced as MenuSections spaces them; `firstGap` sits above the first head. */
export function MenuPageRowView({ row, newIds, firstGap = 0 }: { row: MenuPageRow; newIds?: ReadonlySet<string>; firstGap?: number }) {
  if ('drink' in row) {
    return (
      <View style={styles.pageRow}>
        <MenuDrinkRow drink={row.drink} href={menuDrinkHref(row.drink)} isNew={!!newIds?.has(row.drink.id)} />
      </View>
    );
  }
  return (
    <View style={{ paddingTop: row.first ? firstGap : space.xl }}>
      <SectionHead name={row.head} count={row.count} />
    </View>
  );
}

/**
 * A menu's sections, set like the printed menu. `page`: rows with each
 * drink's picture that open it. `card`: still, for the guest card and print,
 * with each drink's photo or sketch unless `pictures` is 'none'. The card is
 * your own menu, so every drink on it has a real id to draw from.
 */
export function MenuSections({ sections, variant, hrefFor, pictures = 'above', compact = false, newIds, codes = false, foot }: MenuSectionsProps) {
  const card = variant === 'card';
  const href = (d: MenuDrink) => (card ? null : hrefFor ? hrefFor(d) : menuDrinkHref(d));
  const grid = card && pictures === 'above';
  const drawn = card && pictures !== 'none' && sections.some((s) => s.drinks.some(isDrawn));
  return (
    <View style={styles.sections}>
      {sections
        .filter((s) => s.drinks.length > 0)
        .map((s) => (
          <View key={s.id} style={styles.section}>
            <SectionHead name={s.name} count={card ? null : s.drinks.length} />
            {grid ? (
              <View style={styles.cardGrid}>
                {s.drinks.map((d) => (
                  <View key={d.id} style={styles.cardTile}>
                    <DrinkThumb drink={d} drawable={!newIds?.has(d.id)} size={compact ? 96 : 144} />
                    <DrinkLine drink={d} centered card={compact ? 'compact' : true} code={codes} isNew={!!newIds?.has(d.id)} />
                  </View>
                ))}
              </View>
            ) : s.drinks.map((d) => {
              const to = href(d);
              if (card && pictures === 'beside') {
                return (
                  <View key={d.id} style={[styles.row, styles.cardBeside]}>
                    <DrinkThumb drink={d} drawable size={compact ? 56 : 88} />
                    <DrinkLine drink={d} centered={false} card={compact ? 'compact' : true} code={codes} />
                  </View>
                );
              }
              if (card) {
                return (
                  <View key={d.id} style={styles.cardRow}>
                    <DrinkLine drink={d} centered card code={codes} />
                  </View>
                );
              }
              return <MenuDrinkRow key={d.id} drink={d} href={to} isNew={!!newIds?.has(d.id)} />;
            })}
          </View>
        ))}
      {/* One note for the whole card, and no tag: drawings are obviously drawings. */}
      {foot ? (
        <View style={styles.foot}>
          {drawn ? (
            <Caption tone="muted" style={[styles.mono, styles.shrink]}>
              Drawings from each drink’s spec, until there’s a photo
            </Caption>
          ) : (
            <View />
          )}
          {foot}
        </View>
      ) : drawn ? (
        <View style={styles.drawnNote}>
          <Caption tone="muted" align="center" style={styles.mono}>
            Drawn from each spec until there’s a photo
          </Caption>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  section: { gap: space.xs },
  pageRow: { paddingTop: space.xs },
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
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg, paddingTop: space.xl },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1, minWidth: 0 },
  mono: { fontFamily: fontFamilies.mono },
  centered: { alignItems: 'center', gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  nameRowCentered: { justifyContent: 'center', flexWrap: 'wrap' },
});
