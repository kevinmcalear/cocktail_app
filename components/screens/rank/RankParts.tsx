import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
import { displayName, font, layout, radius, space } from '@/constants/tokens';
import type { ItemPicture } from '@/lib/itemImages';
import type { Reason } from '@/lib/rankResult';
import type { Sentiment } from '@/lib/ranking';

/** A tick of haptics on every pick (Prod-rank-A): an answer, a pair, a reason. */
export function tick() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
}

const ANSWERS: { sentiment: Sentiment; label: string }[] = [
  { sentiment: 'loved', label: 'I liked it' },
  { sentiment: 'fine', label: 'It was fine' },
  { sentiment: 'disliked', label: 'Not for me' },
];

/** "How was it?": the first answer, which picks the score band. The first is the filled one, as drawn. */
export function SentimentButtons({ onPick }: { onPick: (s: Sentiment) => void }) {
  return (
    <View style={styles.answers}>
      {ANSWERS.map((a, i) => (
        <Button key={a.sentiment} label={a.label} variant={i === 0 ? 'ink' : 'secondary'} size="lg" onPress={() => onPick(a.sentiment)} />
      ))}
    </View>
  );
}

export interface PairSide {
  /** "Tonight", "In August". */
  when: string;
  /** Where it was had: the bar's name, or Home. */
  where: string;
  /** "Negroni", "Negroni · your 8.4". */
  sub: string;
  picture: ItemPicture | null;
  itemId: string;
}

/** One side of "Which was better?": the whole card is the answer. */
function PairCard({ side, onPress }: { side: PairSide; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={`${side.when}, ${side.where}, ${side.sub}`} onPress={onPress} style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <DrinkImage thumb source={side.picture?.url} generated={side.picture?.isSketch} itemId={side.itemId} accessibilityLabel="" radius="control" style={styles.picture} />
      <View style={styles.cardText}>
        <Caption tone="muted" style={styles.caps} numberOfLines={1}>
          {side.when}
        </Caption>
        <DsText variant="title" numberOfLines={2} style={displayName.card}>
          {side.where}
        </DsText>
        <Caption tone="muted" numberOfLines={2}>
          {side.sub}
        </Caption>
      </View>
    </PressableScale>
  );
}

/** The two drinks side by side with "or" between them, then Too close to call. */
export function Pair({ left, right, onPick, height }: { left: PairSide; right: PairSide; onPick: (side: 'new' | 'old' | 'tie') => void; height: number }) {
  const ds = useDs();
  return (
    <View style={styles.pairBlock}>
      <View style={[styles.pair, { height }]}>
        <PairCard side={left} onPress={() => onPick('new')} />
        <PairCard side={right} onPress={() => onPick('old')} />
        <View style={styles.orWrap} pointerEvents="none">
          <View style={[styles.or, { backgroundColor: ds.c.ground, borderColor: ds.c.lineStrong }]}>
            <Caption tone="muted" italic>
              or
            </Caption>
          </View>
        </View>
      </View>
      <PressableScale accessibilityLabel="Too close to call" onPress={() => onPick('tie')} style={styles.tie}>
        <Body color={ds.accentText} style={styles.tieText}>
          Too close to call
        </Body>
      </PressableScale>
    </View>
  );
}

/** A row of reasons to tick. `max` caps how many can be on; past it, taps on the rest do nothing. */
export function ReasonChips({ reasons, picked, label, onToggle }: { reasons: readonly Reason[]; picked: readonly string[]; label: string; onToggle: (key: string) => void }) {
  return (
    <View role="group" aria-label={label} style={styles.chips}>
      {reasons.map((r) => (
        <Chip key={r.key} multi quiet label={r.label} selected={picked.includes(r.key)} onPress={() => onToggle(r.key)} />
      ))}
    </View>
  );
}

const CORNER = radius.card;

const styles = StyleSheet.create({
  answers: { gap: space.sm },
  pairBlock: { gap: space.md },
  pair: { flexDirection: 'row', gap: space.sm },
  card: { flex: 1, minWidth: 0, borderRadius: CORNER, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: space.sm },
  picture: { flex: 1, width: '100%' },
  cardText: { paddingHorizontal: space.sm, paddingTop: space.md, paddingBottom: space.sm, gap: 2 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  orWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  or: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  tie: { alignSelf: 'center', minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.lg },
  tieText: { ...font.semiBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
