import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, IngredientDrawing, IngredientThumb, PressableScale, Sheet, Tag, Title, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { useItemFlavor } from '@/hooks/useFlavor';
import { useBottleFacts, useFinishedBottles, type BarItem, type FinishedBottle, type ShelfItem } from '@/hooks/useHomeBar';
import { NOTE_KINDS, NOTE_MIN, noteWord } from '@/lib/flavor';
import { itemHref } from '@/lib/itemRoutes';
import { lastedLine } from '@/lib/myBarText';

import type { AwayGroup } from './MakeRows';

/** Bottles to buy listed under With your shelf. */
const UNLOCKS = 3;

interface BottleSheetProps {
  /** The tile tapped, or null when closed. */
  item: ShelfItem | null;
  /** The whole shelf, for "with your Woodford". */
  shelf: ShelfItem[];
  canMake: BarItem[];
  oneAway: AwayGroup[];
  onAdd: (ids: string[]) => void;
  onFinish: (id: string) => void;
  onClose: () => void;
}

const day = (iso: string, year = false) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });

/**
 * A bottle on your shelf, over My Bar (board home-mybar-bottle): what it is,
 * what it tastes like, what it makes with the rest of your shelf or what one
 * more bottle would open, and Finished it, which moves it to Your old bottles
 * with how long it lasted. Running low waits for the shopping list (b37, later).
 */
export function BottleSheet({ item, shelf, canMake, oneAway, onAdd, onFinish, onClose }: BottleSheetProps) {
  const [old, setOld] = useState(false);
  const close = () => {
    setOld(false);
    onClose();
  };
  const finish = (id: string) => {
    onFinish(id);
    close();
  };
  return (
    <Sheet visible={!!item} onClose={close} accessibilityLabel={old ? 'Your old bottles' : (item?.name ?? 'Bottle')}>
      <ScrollView contentContainerStyle={styles.body}>
        {item && old ? <OldBottles onBack={() => setOld(false)} onAdd={onAdd} /> : null}
        {item && !old ? <Bottle item={item} shelf={shelf} canMake={canMake} oneAway={oneAway} onAdd={onAdd} onFinish={finish} onOld={() => setOld(true)} onPage={close} /> : null}
      </ScrollView>
    </Sheet>
  );
}

function Bottle({ item, shelf, canMake, oneAway, onAdd, onFinish, onOld, onPage }: Omit<BottleSheetProps, 'item' | 'onClose'> & { item: ShelfItem; onOld: () => void; onPage: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const facts = useBottleFacts(item.id).data;
  const flavor = useItemFlavor(item.id).data;
  const finished = useFinishedBottles().data ?? [];
  const mine = finished.filter((f) => f.itemId === item.id);
  const names = new Map(shelf.map((s) => [s.id, s.role === 'generic' ? s.name.toLowerCase() : s.name]));
  const uses = (d: BarItem) => d.shelfUses?.includes(item.id);
  const ready = canMake.filter(uses);
  // What one more bottle opens with this one: the bottle, a drink, and what else of yours goes in.
  const unlocks = oneAway.flatMap((g) => {
    const d = g.drinks.find(uses);
    if (!d) return [];
    const others = (d.shelfUses ?? []).filter((id) => id !== item.id).flatMap((id) => names.get(id) ?? []);
    return [{ g, line: others.length ? `${d.name}, with your ${others.slice(0, 2).join(', ')}` : d.name }];
  }).slice(0, UNLOCKS);
  const tastes = flavor ? NOTE_KINDS.filter((d) => flavor.profile[d] >= NOTE_MIN).sort((a, b) => flavor.profile[b] - flavor.profile[a]).slice(0, 5) : [];
  const kindLine = item.kind ? (facts?.kindOf ? `${item.kind}, a kind of ${facts.kindOf.toLowerCase()}` : item.kind) : null;
  const rows = [
    ['Maker', item.maker],
    ['From', facts?.origin ?? null],
    ['Strength', item.abv ? `${Math.round(item.abv * 10) / 10}% ABV` : null],
  ].filter((r): r is [string, string] => !!r[1]);
  const page = () => {
    onPage();
    router.push(itemHref('Ingredient', item.id) as never);
  };
  return (
    <>
      <View style={[styles.picture, { backgroundColor: ds.c.surface }]}>
        <IngredientDrawing id={item.id} name={item.name} />
      </View>
      <View style={styles.title}>
        {kindLine ? <Caption tone="muted">{kindLine}</Caption> : null}
        <Title>{item.name}</Title>
        {item.addedAt ? <Caption tone="muted">{`On your shelf since ${day(item.addedAt)}`}</Caption> : null}
      </View>
      {rows.length ? (
        <View>
          {rows.map(([k, v]) => (
            <View key={k} style={[styles.fact, { borderBottomColor: ds.c.line }]}>
              <Caption tone="muted" style={styles.factKey}>{k}</Caption>
              <Body style={styles.flex}>{v}</Body>
            </View>
          ))}
        </View>
      ) : null}
      {tastes.length ? (
        <View style={styles.block}>
          <Headline role="heading">Tastes like</Headline>
          <View style={styles.tags}>
            {tastes.map((d) => (
              <Tag key={d} label={noteWord(d)} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.block}>
        <Headline role="heading">With your shelf</Headline>
        <Caption tone="muted">
          {ready.length
            ? `In ${ready.length} ${ready.length === 1 ? 'drink' : 'drinks'} you can make: ${ready.slice(0, 3).map((d) => d.name).join(', ')}${ready.length > 3 ? ` and ${ready.length - 3} more` : ''}.`
            : unlocks.length
              ? 'Nothing ready uses it yet. One more bottle would open:'
              : 'Nothing ready uses it yet.'}
        </Caption>
        {ready.length && unlocks.length ? <Caption tone="muted">One more bottle would open:</Caption> : null}
        {unlocks.map(({ g, line }) => (
          <View key={g.bottles.map((b) => b.id).join('+')} style={[styles.unlock, { borderBottomColor: ds.c.line }]}>
            <IngredientThumb id={g.bottles[0].id} name={g.bottles[0].name} size={40} />
            <View style={styles.flex}>
              <Body>{g.bottles[0].name}</Body>
              <Caption tone="muted">{line}</Caption>
            </View>
            <Button label="Add" variant="secondary" accessibilityLabel={`Add ${g.bottles[0].name} to your shelf`} onPress={() => onAdd(g.bottles.map((b) => b.id))} />
          </View>
        ))}
        <PressableScale role="link" onPress={page} style={styles.link}>
          <Body>{`Every drink with ${item.name}`}</Body>
        </PressableScale>
      </View>
      <View style={styles.block}>
        <Button label="Finished it, take it off my shelf" variant="secondary" onPress={() => onFinish(item.id)} />
        <Caption tone="muted">It moves to Your old bottles, so you can buy it again.</Caption>
      </View>
      {mine.length || finished.length ? (
        <View style={styles.block}>
          {mine.length ? <Headline role="heading">You’ve finished this before</Headline> : null}
          {mine.map((f) => (
            <OldRow key={f.id} f={f} />
          ))}
          <PressableScale role="button" onPress={onOld} style={styles.link}>
            <Body>{`Your old bottles · ${finished.length}`}</Body>
          </PressableScale>
        </View>
      ) : null}
    </>
  );
}

/** A finished bottle: when, bought when, and how long it lasted. */
function OldRow({ f, name, onAdd }: { f: FinishedBottle; name?: boolean; onAdd?: (ids: string[]) => void }) {
  const ds = useDs();
  const { bought, lasted } = lastedLine(f.boughtAt, f.finishedAt);
  return (
    <View style={[styles.unlock, { borderBottomColor: ds.c.line }]}>
      {name ? <IngredientThumb id={f.itemId} name={f.name} size={40} /> : null}
      <View style={styles.flex}>
        <Body>{name ? f.name : `Finished ${day(f.finishedAt, true)}`}</Body>
        <Caption tone="muted">{[name ? `Finished ${day(f.finishedAt, true)}` : null, bought].filter(Boolean).join(' · ')}</Caption>
      </View>
      {onAdd ? <Button label="Buy again" variant="secondary" accessibilityLabel={`Put ${f.name} back on your shelf`} onPress={() => onAdd([f.itemId])} /> : lasted ? <Caption tone="muted">{lasted}</Caption> : null}
    </View>
  );
}

/** Every bottle you've finished, newest first, each one tap from your shelf again. */
function OldBottles({ onBack, onAdd }: { onBack: () => void; onAdd: (ids: string[]) => void }) {
  const finished = useFinishedBottles().data ?? [];
  return (
    <>
      <PressableScale role="button" accessibilityLabel="Back to the bottle" onPress={onBack} style={styles.link}>
        <Caption tone="muted">Back</Caption>
      </PressableScale>
      <Title>Your old bottles</Title>
      <Caption tone="muted">Bottles you finished. Buy one again and it goes back on your shelf.</Caption>
      {finished.map((f) => (
        <OldRow key={f.id} f={f} name onAdd={onAdd} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  picture: { alignSelf: 'center', width: 160, aspectRatio: 1, borderRadius: radius.card, overflow: 'hidden' },
  title: { gap: 2 },
  fact: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  factKey: { width: 88 },
  flex: { flex: 1 },
  block: { gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { alignSelf: 'flex-start', minHeight: layout.minTapTarget, justifyContent: 'center' },
});
