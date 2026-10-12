import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Caption, Headline, IngredientThumb, MatchText, RowScore, scoreWords, Surface } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';
import { groupLine, needsLine, pairName, sourceCaption, usesLine } from '@/lib/myBarText';
import { servedCaption } from '@/lib/servedAt';

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
  const logo = bar ? { uri: bar.logo, name: bar.name } : undefined;
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
      logo={logo}
      note={note}
      below={ready ? <CheckList names={uses} /> : null}
      query={text.query}
      matchLook="tint"
      trailing={<RowScore score={score} detail={match} />}
      label={[drink.name, caption, note, ready && uses.length ? `You have ${uses.join(', ')}` : null, scoreWords(score, match)].filter(Boolean).join('. ')}
    />
  );
});

/** The bottles to buy, what they open (three, then all on a tap), and Add. Memoized, as a list row. */
export const BottleGroup = memo(function BottleGroup({ id, group, open, onOpen, text, onAdd, style }: { id: string; group: AwayGroup; open: boolean; onOpen: (id: string) => void; text: MakeRowText; onAdd: (ingredientIds: string[]) => void; style?: StyleProp<ViewStyle> }) {
  const { bottles, drinks } = group;
  const name = pairName(bottles.map((b) => b.name));
  const mine = [...new Set(drinks.flatMap(text.bottlesFor))];
  const rest = drinks.length - PER_BOTTLE;
  return (
    <Surface style={[styles.group, style]}>
      <View style={styles.groupHead}>
        <View style={styles.thumbs}>
          {bottles.map((b) => (
            <IngredientThumb key={b.id} id={b.id} name={b.name} size={bottles.length > 1 ? 36 : 44} />
          ))}
        </View>
        <View style={styles.groupText}>
          <Headline>
            <MatchText text={name} query={text.query} look="tint" />
          </Headline>
          <Caption tone="muted">{groupLine(drinks.length, mine)}</Caption>
        </View>
        <Button label={bottles.length > 1 ? 'Add both' : 'Add'} variant="secondary" accessibilityLabel={`Add ${name} to your shelf`} onPress={() => onAdd(bottles.map((b) => b.id))} />
      </View>
      {(open ? drinks : drinks.slice(0, PER_BOTTLE)).map((d) => (
        <MakeDrink key={d.id} drink={d} text={text} />
      ))}
      {rest > 0 && !open ? <Button label={`and ${rest} more`} variant="ghost" onPress={() => onOpen(id)} /> : null}
    </Surface>
  );
});

const styles = StyleSheet.create({
  group: { gap: space.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumbs: { flexDirection: 'row', gap: space.xs },
  groupText: { flex: 1, gap: 2 },
});
