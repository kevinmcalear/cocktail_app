import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, DsText, PressableScale, Spec, Surface, Title, useDs } from '@/components/ds';
import { BigTimer } from '@/components/prep/StepTimer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { StepPart } from '@/lib/makeSteps';
import type { ScaledLine } from '@/lib/scale';

import { weighHint, type KitItem } from './makeLogic';

/** Make, second screen: everything out on the bench, ticked off as it comes out, and the kit to get out with it. */
export function MakeGather({ lines, got, onToggle, kit }: { lines: ScaledLine[]; got: string[]; onToggle: (id: string) => void; kit: KitItem[] }) {
  const ds = useDs();
  const router = useRouter();
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
              <View style={styles.name}>
                <Body tone={on ? 'muted' : 'ink'} style={on && styles.struck}>
                  {l.name}
                </Body>
                {weighHint(l) ? <Caption tone="muted">{weighHint(l)}</Caption> : null}
              </View>
            </PressableScale>
          );
        })}
      </Surface>
      <Caption tone="muted" role="heading" style={styles.eyebrow}>KIT</Caption>
      <View style={styles.kit}>
        {kit.map((k) =>
          k.equipment ? (
            <Chip key={k.name} label={k.name} selected={false} onPress={() => router.push(`/equipment/${k.equipment}` as never)} accessibilityLabel={`${k.name}, opens the kit page`} />
          ) : (
            <View key={k.name} style={[styles.kitItem, { borderColor: ds.c.lineStrong }]}>
              <Caption>{k.name}</Caption>
            </View>
          ),
        )}
      </View>
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

interface MakeStepProps {
  index: number;
  total: number;
  name: string;
  /** The size being made ("750 ml"), in the eyebrow. */
  size: string | null;
  parts: StepPart[];
  /** The rest of the step after its first sentence, quieter. */
  hint: string | null;
  timer: number | null;
  next: string | null;
}

/** Make, one step: big enough to read from the bench, the amounts in the words, a hint, and its timer. */
export function MakeStep({ index, total, name, size, parts, hint, timer, next }: MakeStepProps) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      <Caption tone="muted" style={styles.eyebrow}>{[`STEP ${index + 1} OF ${total}`, name, size].filter(Boolean).join(' · ').toUpperCase()}</Caption>
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
      {hint ? <Body tone="muted">{hint}</Body> : null}
      {timer ? <BigTimer key={index} seconds={timer} label={`Step ${index + 1} timer`} /> : null}
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
  kit: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kitItem: { minHeight: layout.minTapTarget - space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  next: { gap: 2, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
