import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Spec, Surface, Title, useDs } from '@/components/ds';
import { StepTimer } from '@/components/prep/StepTimer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { StepPart } from '@/lib/makeSteps';
import type { ScaledLine } from '@/lib/scale';

/** Make, second screen: everything out on the bench, ticked off as it comes out. */
export function MakeGather({ lines, got, onToggle }: { lines: ScaledLine[]; got: string[]; onToggle: (id: string) => void }) {
  const ds = useDs();
  const weighed = lines.filter((l) => /\b(k?g)$/.test(l.scaled)).length;
  return (
    <View style={styles.stack}>
      <Title>Get it all out</Title>
      <Surface style={styles.list}>
        {lines.map((l, i) => {
          const on = got.includes(l.id);
          return (
            <PressableScale
              key={l.id}
              role="checkbox"
              aria-checked={on}
              accessibilityLabel={`${l.scaled} ${l.name}`}
              onPress={() => onToggle(l.id)}
              style={[styles.check, i < lines.length - 1 && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <View style={[styles.box, { borderColor: on ? ds.c.ink : ds.c.lineStrong, backgroundColor: on ? ds.c.ink : 'transparent' }]}>
                {on ? <IconSymbol name="checkmark" size={14} color={ds.c.ground} /> : null}
              </View>
              <Spec tone={on ? 'muted' : 'ink'} style={[styles.amount, on && styles.struck]}>
                {l.scaled}
              </Spec>
              <Body tone={on ? 'muted' : 'ink'} style={[styles.name, on && styles.struck]}>
                {l.name}
              </Body>
            </PressableScale>
          );
        })}
      </Surface>
      {weighed >= 2 ? (
        <View style={[styles.tip, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="info.circle" size={18} color={ds.c.ink} />
          <Body style={styles.name}>Put the pan on the scale and press tare before each pour. Fewer things to wash.</Body>
        </View>
      ) : null}
      <Caption tone="muted" style={styles.center}>{`${got.length} of ${lines.length} out`}</Caption>
    </View>
  );
}

/** Make, one step: big enough to read from the bench, the amounts in the words, and its timer. */
export function MakeStep({ index, total, name, parts, timer, suggested, next }: { index: number; total: number; name: string; parts: StepPart[]; timer: number | null; suggested: boolean; next: string | null }) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      <Caption tone="muted" style={styles.eyebrow}>{`STEP ${index + 1} OF ${total} · ${name.toUpperCase()}`}</Caption>
      <DsText variant="title">
        {parts.map((p, i) =>
          p.amount ? (
            <DsText key={i} variant="title" style={[{ backgroundColor: withAlpha(ds.accentText, 0.22) }]}>
              {`${p.amount} ${p.text}`}
            </DsText>
          ) : (
            <DsText key={i} variant="title" >
              {p.text}
            </DsText>
          ),
        )}
      </DsText>
      {timer ? (
        <Surface style={styles.timer}>
          <View style={styles.name}>
            <Body>{suggested ? 'Timer from the step' : 'Timer'}</Body>
            <Caption tone="muted">Starts on tap. It keeps time if you leave the app.</Caption>
          </View>
          <StepTimer seconds={timer} />
        </Surface>
      ) : null}
      {next ? (
        <View style={[styles.next, { borderTopColor: ds.c.line }]}>
          <Caption tone="muted">UP NEXT</Caption>
          <Body tone="muted">{next}</Body>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  eyebrow: { letterSpacing: 0.6 },
  list: { paddingVertical: 0 },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md },
  box: { width: 26, height: 26, borderRadius: radius.control / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  amount: { width: 84 },
  name: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
  tip: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.control, alignItems: 'flex-start' },
  center: { textAlign: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  next: { gap: 2, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
