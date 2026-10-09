import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { PrepStep } from '@/hooks/usePrepCard';
import { timerLabel } from '@/lib/scale';

interface PrepMethodProps {
  steps: PrepStep[];
  /** "10 min", "24 h drip": the lead time, when the card has one. */
  takes: string | null;
  /** Opens the prep card editor; left out when the viewer can't edit. */
  onEdit?: () => void;
}

/** How a prep is made: numbered steps, each with its timer. */
export function PrepMethod({ steps, takes, onEdit }: PrepMethodProps) {
  const ds = useDs();
  if (!steps.length && !onEdit) return null;
  const summary = [steps.length ? `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}` : null, takes].filter(Boolean).join(' · ');

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">Method</Headline>
        {summary ? <Caption tone="muted">{summary}</Caption> : null}
      </View>
      {steps.length ? (
        <View role="list">
          {steps.map((s, i) => (
            <View key={s.position} role="listitem" style={[styles.step, i < steps.length - 1 && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.number, { backgroundColor: ds.c.raised }]}>
                <Caption>{String(i + 1)}</Caption>
              </View>
              <View style={styles.text}>
                <Body>{s.body}</Body>
                {s.timer_seconds ? <Caption tone="accent">{timerLabel(s.timer_seconds)}</Caption> : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Body tone="muted">No method yet. Add the steps, how long it keeps and how much a batch makes.</Body>
      )}
      {onEdit ? (
        steps.length ? (
          <TextLink label="Edit the method and how it keeps" onPress={onEdit} />
        ) : (
          <Button label="Add how it's made" variant="secondary" onPress={onEdit} style={styles.add} />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  step: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  number: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  add: { alignSelf: 'flex-start' },
});
