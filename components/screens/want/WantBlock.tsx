import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { useCollectToggle } from '@/components/screens/published/useCollectToggle';
import { BlockLabel, CardGroup, CardRow } from '@/components/screens/rankings/ScoreRows';
import { Note } from '@/components/screens/scores/ScoreParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayName, space } from '@/constants/tokens';
import { useItemScores } from '@/hooks/useFlavor';
import { useOnNearYou, useWantMatches } from '@/hooks/useWant';
import { formatScore } from '@/lib/ranking';
import { nearLine, type NearBar } from '@/lib/want';

/** Bars shown under On near you. */
const SHOWN = 3;
const MARK = 44;

export interface WantBlockProps {
  itemId: string;
  name: string;
  /** "Had it? Rank it": open the rank sheet. */
  onRank: () => void;
}

/**
 * A drink page's want block (Next-phone "matchline"): how well it fits your
 * taste and why, Want (Wanted once it's on your Want list; tap again to let
 * it go) beside "Had it? Rank it", the note that we'll tell you when it's
 * on, and the bars near you pouring it now with their score for it.
 */
export function WantBlock({ itemId, name, onRank }: WantBlockProps) {
  const { matchFor, likeFor } = useWantMatches([itemId]);
  const want = useCollectToggle({ kind: 'drink', itemId });
  const near = useOnNearYou([{ itemId, name }]);
  const bars = (near.byItem[itemId] ?? []).slice(0, SHOWN);
  const { data: scores = {} } = useItemScores(bars.map((b) => b.drinkId));
  const match = matchFor(itemId);

  return (
    <View style={styles.block}>
      {match ? (
        <CardGroup>
          <CardRow icon="heart" title={match} sub={likeFor(itemId) ?? undefined} />
        </CardGroup>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label={want.saved ? 'Wanted' : 'Want'}
          variant={want.saved ? 'secondary' : 'ink'}
          accessibilityLabel={want.saved ? `Wanted. Take ${name} off your Want list` : `Want ${name}`}
          disabled={want.pending}
          onPress={want.toggle}
          style={styles.flex}
        />
        <Button label="Had it? Rank it" variant="secondary" onPress={onRank} style={styles.flex} />
      </View>
      {want.error ? (
        <Caption tone="muted" role="alert">
          {want.error}
        </Caption>
      ) : null}
      {want.saved ? (
<Note icon="bell">We’ll tell you when it’s on near you.</Note>
      ) : null}
      {bars.length ? (
        <View style={styles.near}>
          <BlockLabel>On near you</BlockLabel>
          <View role="list">
            {bars.map((b) => (
              <NearBarRow key={b.barId} bar={b} line={nearLine(b, near.miles)} score={scores[b.drinkId]} />
            ))}
          </View>
        </View>
      ) : null}
      {want.sheet}
    </View>
  );
}

/** A bar pouring it now: its mark, its name in the display face, "Tonight · 0.5 mi", its score for the drink. Opens the bar's drink. */
function NearBarRow({ bar, line, score }: { bar: NearBar; line: string; score: number | undefined }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${bar.barName}. ${line}${score != null ? `. Score ${formatScore(score)}` : ''}`}
      onPress={() => router.push(`/cocktail/${bar.drinkId}` as Href)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <BarMark name={bar.barName} logoUrl={bar.barLogo} profileId={bar.barId} size={MARK} />
      <View style={styles.flex}>
        <DsText variant="title" numberOfLines={1} style={displayName.row}>
          {bar.barName}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {line}
        </Caption>
      </View>
      {score != null ? <Body>{formatScore(score)}</Body> : null}
      <IconSymbol name="chevron.right" size={14} color={ds.c.faint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  buttons: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  near: { gap: space.xs, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
