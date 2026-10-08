import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PalateFlower, Spec, Surface, Tag, useDs } from '@/components/ds';
import { FamilyDot, PalateLegend } from '@/components/screens/taste/PalateParts';
import { space } from '@/constants/tokens';
import { useFlavorBaseline, useItemFlavor, useMyTaste } from '@/hooks/useFlavor';
import { COLD_START_DRINKS, DIMENSIONS, LABEL, level, matchPercent, matchReasons } from '@/lib/flavor';
import { meet } from '@/lib/palate';

// Tastes below this are left off the word list: "barely" isn't worth a row.
const SHOWN_FROM = 0.15;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Home mode's flavor block on the drink page: the drink as an outline over
 * your palate (lib/palate.ts), how well it fits and why, then its tastes in
 * words (never numbers, which would claim more precision than a profile from
 * the spec has). Without a taste yet, the drink's own flower.
 */
export function FlavorSection({ itemId }: { itemId: string }) {
  const ds = useDs();
  const [width, setWidth] = useState(0);
  const { data: flavor } = useItemFlavor(itemId);
  const { data: me } = useMyTaste();
  const { data: baseline } = useFlavorBaseline();
  if (!flavor) return null;

  const profile = flavor.profile;
  const toGo = me ? COLD_START_DRINKS - me.rankedDrinks : COLD_START_DRINKS;
  const scored = me && me.basis === 'ranked' && toGo <= 0 ? matchPercent(me.taste, profile) : null;
  const hasTaste = !!me && Object.keys(me.taste).length > 0;
  const meeting = hasTaste ? meet(me!.taste, profile, baseline ?? null) : null;
  const words = DIMENSIONS.filter((d) => profile[d] >= SHOWN_FROM).sort((a, b) => profile[b] - profile[a]);
  const size = Math.min(width, 360);

  return (
    <Surface style={styles.card}>
      <View style={styles.head}>
        <Headline role="heading">Flavor</Headline>
        {scored !== null ? (
          <View style={styles.match}>
            <Spec color={ds.accentText}>{`${scored}%`}</Spec>
            <Caption tone="muted">match for you</Caption>
          </View>
        ) : null}
      </View>
      <View style={styles.center} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          hasTaste ? (
            <PalateFlower values={me!.taste} compare={profile} ghost size={size} labels on={ds.c.surface} />
          ) : (
            <PalateFlower values={profile} size={size} labels on={ds.c.surface} />
          )
        ) : null}
      </View>
      {hasTaste ? <PalateLegend items={['drink', 'ghost']} /> : null}
      {hasTaste ? <Body>{matchReasons(me!.taste, profile, me!.basis, baseline)}</Body> : null}
      {meeting && (meeting.shared.length || meeting.more || meeting.less) ? (
        <View style={styles.tags}>
          {meeting.shared.map((d) => (
            <Tag key={d} tone="accent" label={`${LABEL[d]}, like you`} />
          ))}
          {meeting.more ? <Tag label={`more ${LABEL[meeting.more]} than usual`} /> : null}
          {meeting.less ? <Tag label={`less ${LABEL[meeting.less]} than usual`} /> : null}
        </View>
      ) : null}
      {toGo > 0 ? <Caption tone="muted">{`Rank ${toGo} more drink${toGo === 1 ? '' : 's'} you've had to see how well this matches your taste.`}</Caption> : null}
      <View role="list" style={[styles.words, { borderTopColor: ds.c.line }]}>
        {words.map((d) => (
          <View key={d} role="listitem" style={styles.word}>
            <FamilyDot dim={d} />
            <Body style={styles.flex}>{capital(LABEL[d])}</Body>
            <Caption tone="muted">{level(profile[d])}</Caption>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  match: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  center: { alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  words: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, columnGap: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  word: { flexDirection: 'row', alignItems: 'center', gap: space.sm, width: '45%' },
  flex: { flex: 1 },
});
