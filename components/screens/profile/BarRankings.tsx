import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, DsText, Headline, PressableScale, Spec, Tag, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useBarTopDrinks } from '@/hooks/useRankings';
import { MENU_LABEL, splitTopDrinks, topDrinkCaption, topDrinkHref, topDrinkLabel, type BarTopDrink } from '@/lib/barTopDrinks';
import { MIN_RANKERS, formatScore } from '@/lib/ranking';

import { RankFlow } from '../rank/RankActions';
import { useAgeGate } from '../safety/AgeGate';

interface BarRankingsProps {
  bar: { id: string; display_name: string; locality: string | null; city: string | null; country_code: string | null; is_closed: boolean };
}

/**
 * A bar's Rankings tab: its drinks by how people rank them here, best first,
 * each with a way to rank it. Until a drink has MIN_RANKERS rankings it shows
 * a count, not a score, and the tab asks people to rank what they've had.
 */
export function BarRankings({ bar }: BarRankingsProps) {
  const router = useRouter();
  const signedIn = !!useAuth().user;
  const { data, isLoading, error } = useBarTopDrinks(bar.id);
  const [ranking, setRanking] = useState<BarTopDrink | null>(null);
  // Ranking needs a confirmed age.
  const ageGate = useAgeGate();
  const rank = (d: BarTopDrink) => (signedIn ? ageGate.gate(() => setRanking(d)) : router.push('/auth/login'));

  if (error) return <Body tone="muted">{"Couldn't load this bar's rankings. Check your connection and try again."}</Body>;
  if (isLoading || !data) return <Caption tone="muted">Loading rankings…</Caption>;

  const { scored, early, unranked } = splitTopDrinks(data);
  const list = (rows: BarTopDrink[]) => rows.map((d) => <TopDrinkRow key={d.item_id} drink={d} onRank={() => rank(d)} />);

  return (
    <View style={styles.block}>
      {scored.length ? (
        <View role="list">{list(scored)}</View>
      ) : (
        <RankInvite name={bar.display_name} started={early.length > 0} hasDrinks={data.length > 0} />
      )}
      {early.length ? (
        <Group title={scored.length ? 'Early' : 'Ranked so far'} hint={`A score shows once ${MIN_RANKERS} people rank a drink here.`}>
          {list(early)}
        </Group>
      ) : null}
      {unranked.length ? (
        <Group title="Not ranked yet" hint={signedIn ? 'Had one of these here? Rank it.' : 'Had one of these here? Sign in to rank it.'}>
          {list(unranked)}
        </Group>
      ) : null}
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

/** The empty state: nothing has a score here yet, so ask people to rank what they've had. */
function RankInvite({ name, started, hasDrinks }: { name: string; started: boolean; hasDrinks: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.invite, { borderColor: ds.c.lineStrong }]}>
      <Headline role="heading">{started ? 'No scores here yet' : 'Be the first to rank a drink here'}</Headline>
      <Body tone="muted">
        {[
          started
            ? `People have started ranking drinks at ${name}. A drink gets a score once ${MIN_RANKERS} people rank it.`
            : `Nobody has ranked a drink at ${name} yet. Each drink gets a score once ${MIN_RANKERS} people rank it.`,
          hasDrinks ? 'Had something here? Rank it against the others you’ve had.' : 'Had something here? Rank it from its drink page.',
        ].join(' ')}
      </Body>
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

/** A drink in the list: its place, picture, name and score, opening its page, and a Rank button beside it. */
function TopDrinkRow({ drink: d, onRank }: { drink: BarTopDrink; onRank: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const caption = topDrinkCaption(d);
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <PressableScale role="link" accessibilityLabel={`${topDrinkLabel(d)}. Open`} onPress={() => router.push(topDrinkHref(d) as Href)} style={styles.open}>
        {d.position ? (
          <DsText variant="title" tone="accent" style={styles.position}>
            {d.position}
          </DsText>
        ) : null}
        <View style={styles.thumb}>
          <DrinkImage source={d.image_url} generated={!!d.image_is_generated} glass={null} itemId={d.item_id} accessibilityLabel={d.name} radius="control" hideTag />
        </View>
        <View style={styles.text}>
          <Headline numberOfLines={2}>{d.name}</Headline>
          {caption ? <Caption tone="muted">{caption}</Caption> : null}
          {d.menu ? <Tag label={MENU_LABEL[d.menu]} tone={d.menu === 'current' ? 'accent' : 'default'} /> : null}
        </View>
      </PressableScale>
      <View style={styles.end}>
        {d.score !== null ? <Spec>{formatScore(d.score)}</Spec> : null}
        <Button label="Rank" variant="secondary" accessibilityHint={`Rank ${d.name} against others you've had`} onPress={onRank} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xl },
  group: { gap: space.xs },
  invite: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  open: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  position: { minWidth: space.xl, textAlign: 'center' },
  thumb: { width: 56 },
  text: { flex: 1, minWidth: 0, gap: space.xs },
  end: { alignItems: 'flex-end', gap: space.xs },
});
