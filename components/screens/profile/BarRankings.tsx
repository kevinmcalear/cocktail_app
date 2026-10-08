import { useRouter, type Href } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, Headline, PressableScale, Spec, Tag, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useBarTopDrinks } from '@/hooks/useRankings';
import { pastMenuLabel, splitTopDrinks, topDrinkCaption, topDrinkHref, topDrinkLabel, type BarTopDrink } from '@/lib/barTopDrinks';
import { MIN_RANKERS, formatScore } from '@/lib/ranking';

import { RankFlow } from '../rank/RankActions';
import { useAgeGate } from '../safety/AgeGate';
import { RankPickSheet } from './RankPickSheet';

interface BarRankingsProps {
  bar: { id: string; display_name: string; locality: string | null; city: string | null; country_code: string | null; is_closed: boolean };
}

/**
 * A bar's Top drinks tab: its drinks by how people rank them here, best
 * first. Until a drink has MIN_RANKERS ratings it shows a count, not a
 * score. "Rank a drink" picks one of the bar's drinks and opens the
 * comparison sheet, so every ranking moves this list.
 */
export function BarRankings({ bar }: BarRankingsProps) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const { data, isLoading, error } = useBarTopDrinks(bar.id);
  const [picking, setPicking] = useState(false);
  const [ranking, setRanking] = useState<BarTopDrink | null>(null);
  // iOS can't present the rank sheet until the picker has gone (onDismiss).
  const picked = useRef<BarTopDrink | null>(null);
  // Ranking needs a confirmed age.
  const ageGate = useAgeGate();

  if (error) return <Body tone="muted">{"Couldn't load this bar's top drinks. Check your connection and try again."}</Body>;
  if (isLoading || !data) return <Caption tone="muted">Loading top drinks…</Caption>;

  const { scored, early } = splitTopDrinks(data);
  const startRanking = () => (signedIn ? ageGate.gate(() => setPicking(true)) : router.push('/auth/login'));
  const pick = (d: BarTopDrink) => {
    setPicking(false);
    if (Platform.OS === 'ios') picked.current = d;
    else setRanking(d);
  };

  let prompt;
  if (scored.length) prompt = 'Had something here? Your ranking moves this list.';
  else if (early.length) prompt = `No drink here has a score yet. A drink gets one once ${MIN_RANKERS} people rank it. Had something here? Rank it.`;
  else if (data.length) prompt = `Nobody has ranked a drink at ${bar.display_name} yet. Had something here? Be the first.`;
  else prompt = `Nothing from ${bar.display_name} to rank here yet. Rank a drink from its page and say you had it here.`;

  return (
    <View style={styles.block}>
      {scored.length ? (
        <View role="list">
          {scored.map((d) => (
            <TopDrinkRow key={d.item_id} drink={d} />
          ))}
        </View>
      ) : null}
      {early.length ? (
        <Group title={scored.length ? 'Early' : 'Ranked so far'} hint={`A score shows once ${MIN_RANKERS} people rank a drink here.`}>
          {early.map((d) => (
            <TopDrinkRow key={d.item_id} drink={d} />
          ))}
        </Group>
      ) : null}
      <RankPrompt text={prompt} onRank={data.length ? startRanking : null} signedIn={signedIn} />
      <RankPickSheet
        visible={picking}
        barName={bar.display_name}
        drinks={data}
        onPick={pick}
        onClose={() => setPicking(false)}
        onDismiss={() => {
          if (picked.current) setRanking(picked.current);
          picked.current = null;
        }}
      />
      {ranking ? (
        <RankFlow
          item={{ id: ranking.item_id, name: ranking.name, bar_id: ranking.bar_id }}
          picture={ranking.image_url ? { url: ranking.image_url, isSketch: !!ranking.image_is_generated, isOutdated: false, credit: null, sourceUrl: null } : null}
          atBar={{ ...bar, postcode: null }}
          onClose={() => setRanking(null)}
        />
      ) : null}
      {ageGate.sheet}
    </View>
  );
}

/** The card under the list: what a ranking does here, and the way in. */
function RankPrompt({ text, onRank, signedIn }: { text: string; onRank: (() => void) | null; signedIn: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.prompt, { backgroundColor: ds.c.surface }]}>
      <Body tone="muted" style={styles.promptText}>
        {text}
      </Body>
      {onRank ? <Button label={signedIn ? 'Rank a drink' : 'Sign in to rank'} onPress={onRank} /> : null}
    </View>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Headline role="heading">{title}</Headline>
      <Caption tone="muted">{hint}</Caption>
      <View role="list">{children}</View>
    </View>
  );
}

/** A drink in the list: its place, picture, name, ratings and score. Opens the drink. */
function TopDrinkRow({ drink: d }: { drink: BarTopDrink }) {
  const ds = useDs();
  const router = useRouter();
  const caption = topDrinkCaption(d);
  const past = pastMenuLabel(d);
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${topDrinkLabel(d)}. Open`}
      onPress={() => router.push(topDrinkHref(d) as Href)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      {d.position ? (
        <Spec tone={d.position === 1 ? 'accent' : 'muted'} style={styles.position}>
          {d.position}
        </Spec>
      ) : null}
      <View style={styles.thumb}>
        <DrinkImage thumb source={d.image_url} generated={!!d.image_is_generated} glass={null} itemId={d.item_id} accessibilityLabel={d.name} radius="control" hideTag />
      </View>
      <View style={styles.text}>
        <Body numberOfLines={2}>{d.name}</Body>
        {caption || past ? (
          <View style={styles.meta}>
            {caption ? <Caption tone="muted">{caption}</Caption> : null}
            {past ? <Tag label={past} /> : null}
          </View>
        ) : null}
      </View>
      {d.score !== null ? <Spec>{formatScore(d.score)}</Spec> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xl },
  group: { gap: space.xs },
  promptText: { flex: 1, minWidth: 200 },
  prompt: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  position: { minWidth: space.lg },
  thumb: { width: 52 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
