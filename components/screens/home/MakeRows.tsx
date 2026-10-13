import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Button, Caption, DrinkImage, IngredientThumb, MatchText, PressableScale, RowScore, scoreWords, Surface, TextLink, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';
import { groupLine, needsLine, pairName, sourceCaption, usesLine } from '@/lib/myBarText';
import { servedCaption } from '@/lib/servedAt';

import { BarMark } from './BarMark';
import { CheckList } from './CheckList';

/** Drinks under each bottle before "and N more". */
const PER_BOTTLE = 3;

/** Drinks one or two bottles away, under what to buy. */
export interface AwayGroup {
  bottles: BarItem[];
  drinks: BarItem[];
}

/** "92% match" (under the score, once the person has ranked enough), or the caption's note ("Make the Simple syrup first"). */
type TextFor = (id: string) => string | undefined;
/** What a What to make row says: its prep note in the caption, its score and % match at the end (g145, b47), what of yours it uses. */
export interface MakeRowText {
  matchFor: TextFor;
  noteFor: TextFor;
  scoreFor: (id: string) => number | undefined;
  /** The shelf things a drink uses, as they read in a sentence ("Woodford Reserve", "lemon"). */
  usesFor: (drink: BarItem) => string[];
  /** Just the bottles of yours a drink uses, for a group's "uses your Campari, Fernet". */
  bottlesFor: (drink: BarItem) => string[];
  /** What to make's search, lit in names and lines. */
  query?: string;
}

/**
 * A drink you can make (`ready`: what you have, ticked off under it) or one or
 * two bottles away ("Uses your Woodford, Campari"). `needs`: a search's drink
 * two bottles away, with the pair it needs. Memoized like the other list rows.
 */
export const MakeDrink = memo(function MakeDrink({ drink, text, ready, needs }: { drink: BarItem; text: MakeRowText; ready?: boolean; needs?: { name: string }[] }) {
  // "Classic · served at Harry's Bar, The Gold Room +5", "The Long Island Bar · uses Rye Whiskey, not Bourbon · Make the Simple syrup first".
  const served = drink.served ? servedCaption(drink.served.count, drink.served.bars) : null;
  const caption = needs ? undefined : [sourceCaption(drink.from?.name, served), drink.variation, text.noteFor(drink.id)].filter(Boolean).join(' · ');
  const bar = needs ? undefined : (drink.served?.bars[0] ?? drink.from);
  // The bar's monogram, one serif letter outlined in its colour, as the canvas draws it (its logo when it has one).
  const mark = bar ? <BarMark name={bar.name} logoUrl={bar.logo} size={20} letter /> : undefined;
  const uses = text.usesFor(drink);
  const note = needs ? needsLine(needs.map((n) => n.name)) : ready ? undefined : usesLine(uses);
  const score = text.scoreFor(drink.id);
  const match = text.matchFor(drink.id);
  return (
    <DrinkRow
      name={drink.name}
      itemId={drink.id}
      href={itemHref('Cocktail', drink.id)}
      imageUrl={drink.imageUrl}
      glass={drink.glass}
      caption={caption}
      mark={mark}
      compact
      note={note}
      below={ready ? <CheckList names={uses} /> : null}
      query={text.query}
      matchLook="tint"
      trailing={<RowScore score={score} detail={match} />}
      label={[drink.name, caption, note, ready && uses.length ? `You have ${uses.join(', ')}` : null, scoreWords(score, match)].filter(Boolean).join('. ')}
    />
  );
});

/**
 * A drink as a card, two to a row in a desktop's What to make
 * (home-mybar-desktop): the drawing, the name, where it's served, what of
 * yours it uses on one line, and the score with % match.
 */
export const MakeCard = memo(function MakeCard({ drink, text, needs }: { drink: BarItem; text: MakeRowText; needs?: { name: string }[] }) {
  const ds = useDs();
  const router = useRouter();
  const served = drink.served ? servedCaption(drink.served.count, drink.served.bars) : null;
  const caption = needs ? needsLine(needs.map((n) => n.name)) : [sourceCaption(drink.from?.name, served), drink.variation, text.noteFor(drink.id)].filter(Boolean).join(' · ');
  const uses = text.usesFor(drink);
  const score = text.scoreFor(drink.id);
  const match = text.matchFor(drink.id);
  const has = uses.length ? `You have ${uses.join(', ')}` : null;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[drink.name, caption, has, scoreWords(score, match)].filter(Boolean).join('. ')}
      onPress={() => router.push(itemHref('Cocktail', drink.id) as never)}
      style={[styles.card, { backgroundColor: ds.c.surface }]}
    >
      <View style={styles.cardThumb}>
        <DrinkImage thumb sketchDetail="thumb" source={drink.imageUrl} glass={drink.glass} itemId={drink.id} accessibilityLabel={drink.name} radius="control" />
      </View>
      <View style={styles.groupText}>
        <Body numberOfLines={2} style={styles.cardName}>
          <MatchText text={drink.name} query={text.query} look="tint" />
        </Body>
        {caption ? (
          <Caption tone="muted" numberOfLines={3}>
            {caption}
          </Caption>
        ) : null}
        {has ? <Caption numberOfLines={1}>{has}</Caption> : null}
      </View>
      <RowScore score={score} detail={match} />
    </PressableScale>
  );
});

/** The bottles to buy, what they open (three, then all on a tap), and Add. Memoized, as a list row. */
export const BottleGroup = memo(function BottleGroup({ id, group, open, onOpen, text, onAdd, style }: { id: string; group: AwayGroup; open: boolean; onOpen: (id: string) => void; text: MakeRowText; onAdd: (ingredientIds: string[]) => void; style?: StyleProp<ViewStyle> }) {
  const { bottles, drinks } = group;
  const name = pairName(bottles.map((b) => b.name));
  const mine = [...new Set(drinks.flatMap(text.bottlesFor))];
  const rest = drinks.length - PER_BOTTLE;
  const ds = useDs();
  return (
    <Surface style={[styles.group, style]}>
      <View style={[styles.groupHead, { borderBottomColor: ds.c.line }]}>
        {/* A pair's two bottles overlap, so the name keeps the room (home-mybar-make-two). */}
        <View style={styles.thumbs}>
          {bottles.map((b, i) => (
            <View key={b.id} style={i ? [styles.overlap, { borderColor: ds.c.surface }] : null}>
              <IngredientThumb id={b.id} name={b.name} size={bottles.length > 1 ? 40 : 48} />
            </View>
          ))}
        </View>
        <View style={styles.groupText}>
          <Body numberOfLines={3} style={styles.cardName}>
            <MatchText text={name} query={text.query} look="tint" />
          </Body>
          <Caption tone="muted">{groupLine(drinks.length, mine)}</Caption>
        </View>
        <Button label={bottles.length > 1 ? 'Add both' : 'Add'} variant="secondary" accessibilityLabel={`Add ${name} to your shelf`} onPress={() => onAdd(bottles.map((b) => b.id))} style={styles.add} />
      </View>
      {(open ? drinks : drinks.slice(0, PER_BOTTLE)).map((d) => (
        <MakeDrink key={d.id} drink={d} text={text} />
      ))}
      {rest > 0 && !open ? <TextLink label={`and ${rest} more`} onPress={() => onOpen(id)} /> : null}
    </Surface>
  );
});

const styles = StyleSheet.create({
  group: { gap: 0 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumbs: { flexDirection: 'row' },
  overlap: { marginLeft: -space.lg, marginTop: space.sm, borderWidth: 2, borderRadius: radius.control + 2 },
  groupText: { flex: 1, minWidth: 0, gap: 2 },
  add: { paddingHorizontal: space.md + 2 },
  card: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingLeft: space.sm + 2, paddingRight: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  cardThumb: { width: 56 },
  cardName: { fontFamily: fontFamilies.bodySemiBold },
});
