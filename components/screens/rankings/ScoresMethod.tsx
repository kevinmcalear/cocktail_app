import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Title } from '@/components/ds';
import { displayName, font, space } from '@/constants/tokens';
import { SCORE_LADDER } from '@/lib/scoreLadder';

import { BlockLabel, CardGroup, CardRow } from './ScoreRows';

/**
 * How scores work, the published method (Sta-rankings-desk, Next-phone
 * "method"): when a score appears, rung by rung, and how it changes with time.
 * Beside the rankings on a desktop; a page of its own on phones.
 */
export function ScoresMethod() {
  return (
    <View style={styles.page}>
      <Caption tone="muted" style={styles.eyebrow}>
        Published method
      </Caption>
      <Title>How scores work</Title>
      <Body tone="muted">Scores come from people comparing drinks two at a time, 0 to 10. Each row in a list is one drink at one bar.</Body>
      <BlockLabel>When a score appears</BlockLabel>
      <View>
        {SCORE_LADDER.map((rung, i) => (
          <View key={rung.name} style={styles.rung} accessible accessibilityLabel={`${i + 1}. ${rung.name}. ${rung.when}`}>
            <DsText variant="title" tone="muted" style={[displayName.row, styles.number]}>
              {i + 1}
            </DsText>
            <View style={styles.flex}>
              <Body style={styles.strong}>{rung.name}</Body>
              <Caption tone="muted">{rung.when}</Caption>
            </View>
          </View>
        ))}
      </View>
      <BlockLabel>As time goes on</BlockLabel>
      <CardGroup>
        <CardRow icon="clock" title="Older ranks count less" sub="Half weight after about 180 days" />
        <CardRow icon="arrow.left.and.right" title="A new spec starts a new score" sub="Linked to the old one" />
      </CardGroup>
      <CardGroup>
        <CardRow icon="lock.shield.fill" title="Ratings rule" sub="Nobody can pay to change a ranking" />
      </CardGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.md },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
  rung: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  number: { minWidth: space.xl, textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  strong: { ...font.medium },
});
