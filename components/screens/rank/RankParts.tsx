import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, DrinkImage, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { usePublicBars, type RankVenue } from '@/hooks/useRankings';
import type { ItemPicture } from '@/lib/itemImages';
import type { Sentiment } from '@/lib/ranking';

const SENTIMENT_LABEL: Record<Sentiment, string> = { loved: 'Loved it', fine: 'It was fine', disliked: "Didn't like it" };

export function sentimentLabel(s: Sentiment): string {
  return SENTIMENT_LABEL[s];
}

/** "How was it?": the first answer, which picks the score band. */
export function SentimentPicker({ onPick }: { onPick: (s: Sentiment) => void }) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      {(Object.keys(SENTIMENT_LABEL) as Sentiment[]).map((s) => (
        <PressableScale key={s} accessibilityLabel={SENTIMENT_LABEL[s]} onPress={() => onPick(s)} style={[styles.answer, { backgroundColor: ds.c.raised }]}>
          <Body style={styles.strong}>{SENTIMENT_LABEL[s]}</Body>
        </PressableScale>
      ))}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="radio" aria-selected={selected} accessibilityLabel={label} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? ds.c.ink : ds.c.raised }]}>
      <Caption color={selected ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
}

/**
 * "Where did you have it?": the drink's own bar (if it has a public profile),
 * at home, or another public bar found by name. `null` is at home.
 */
export function WherePicker({ ownBar, value, onChange }: { ownBar: RankVenue | null; value: RankVenue | null; onChange: (v: RankVenue | null) => void }) {
  const ds = useDs();
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const { data: found } = usePublicBars(search);
  const other = value && value.id !== ownBar?.id ? value : null;
  return (
    <View style={styles.where}>
      <Caption tone="muted">Where did you have it?</Caption>
      <View style={styles.chips}>
        <View role="radiogroup" accessibilityLabel="Where did you have it?" style={styles.chips}>
          {ownBar ? <Chip label={`At ${ownBar.display_name}`} selected={value?.id === ownBar.id} onPress={() => onChange(ownBar)} /> : null}
          <Chip label="At home" selected={value === null} onPress={() => onChange(null)} />
          {other ? <Chip label={`At ${other.display_name}`} selected onPress={() => onChange(other)} /> : null}
        </View>
        <PressableScale aria-expanded={searching} accessibilityLabel="Another bar" onPress={() => setSearching(!searching)} style={[styles.chip, { backgroundColor: ds.c.raised }]}>
          <Caption>Another bar</Caption>
        </PressableScale>
      </View>
      {searching ? (
        <View style={styles.where}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search bars by name"
            placeholderTextColor={ds.c.muted}
            accessibilityLabel="Search bars by name"
            autoFocus
            autoCorrect={false}
            style={[styles.input, { color: ds.c.ink, backgroundColor: ds.c.raised }]}
          />
          <View style={styles.chips}>
            {(found ?? []).map((v) => (
              <Chip
                key={v.id}
                label={v.locality ? `${v.display_name}, ${v.locality}` : v.display_name}
                selected={value?.id === v.id}
                onPress={() => {
                  onChange(v);
                  setSearching(false);
                  setSearch('');
                }}
              />
            ))}
            {search.trim().length >= 2 && found?.length === 0 ? <Caption tone="muted">No public bars match.</Caption> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export interface VsSide {
  title: string;
  /** The drink's own name, for screen readers. */
  name: string;
  detail: string;
  picture: ItemPicture | null;
}

/** One side of "Which was better?". The whole card is the answer. */
export function VsCard({ side, onPress, height }: { side: VsSide; onPress: () => void; height: number }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={`${side.title}, ${side.name}: ${side.detail}`} onPress={onPress} style={[styles.card, { height, borderColor: ds.c.lineStrong }]}>
      <DrinkImage source={side.picture?.url} generated={side.picture?.isSketch} accessibilityLabel={side.name} radius={0} hideTag style={styles.fill} />
      <View style={[styles.label, { backgroundColor: ds.c.surface }]}>
        <Body style={styles.strong} numberOfLines={1}>
          {side.title}
        </Body>
        <Caption tone="muted" numberOfLines={1}>
          {side.detail}
        </Caption>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  answer: { minHeight: 56, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.xl, justifyContent: 'center' },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  where: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  chip: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
  input: { ...type.body, fontFamily: fontFamilies.body, minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.control },
  card: { borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1.5, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  label: { position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm, borderRadius: radius.control, borderCurve: 'continuous', paddingHorizontal: space.md, paddingVertical: space.sm },
});
