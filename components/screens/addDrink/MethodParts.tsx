import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Field, PressableScale, Switch, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { addPart, linePart, MAX_PARTS, PART_JOINS, partsMethods, startParts, toggleLine, type DraftPart } from '@/lib/drinkParts';
import { samePick, type StepProps, type WizardPick } from '@/lib/drinkWizard';

import { PickStep } from './PickStep';
import { WizardChip } from './WizardChrome';

/**
 * Made in parts on the Method step (canvas Q20b, approved 26 Oct 2026): a
 * switch, and when it's on each part's name, the lines it uses (tapped from
 * the spec), how it's made and, after the first, how it joins.
 */
export function PartsSwitch({ draft, set }: StepProps) {
  const ds = useDs();
  const on = !!draft.parts?.length;
  const turn = (next: boolean) => set(next ? { parts: startParts(draft) } : { parts: null, methods: partsMethods(draft.parts ?? []) });
  return (
    <View style={[styles.switch, { backgroundColor: ds.c.surface }]}>
      <View style={styles.flex}>
        <Body>Made in parts</Body>
        <Caption tone="muted">Each part has its own lines and method</Caption>
      </View>
      <Switch value={on} onValueChange={turn} label="Made in parts" />
    </View>
  );
}

/** The parts, each in a card, and Add a part. */
export function MethodParts({ draft, set, options }: StepProps & { options: WizardPick[] }) {
  const ds = useDs();
  const parts = draft.parts ?? [];
  // The draft's one list of methods follows the parts, for everything that reads one.
  const put = (next: DraftPart[]) => set({ parts: next, methods: partsMethods(next) });
  const change = (at: number, patch: Partial<DraftPart>) => put(parts.map((p, i) => (i === at ? { ...p, ...patch } : p)));
  const lines = [...draft.lines, ...draft.garnishes];
  // A line in no part saves into the first (a garnish into the last), so it shows there.
  const garnishes = new Set(draft.garnishes.map((g) => g.key));
  return (
    <View style={styles.stack}>
      {parts.map((p, i) => (
        <View key={i} role="group" accessibilityLabel={`Part ${i + 1}`} style={[styles.card, { borderColor: ds.c.line }]}>
          <View style={styles.head}>
            <View style={[styles.number, { backgroundColor: ds.accentFill.fill }]}>
              <DsText variant="caption" color={ds.accentFill.text}>
                {String(i + 1)}
              </DsText>
            </View>
            <View style={styles.flex}>
              <Field label={`Name of part ${i + 1}`} hideLabel placeholder={`Name of part ${i + 1}`} value={p.name} onChangeText={(name) => change(i, { name })} maxLength={60} autoCapitalize="sentences" />
            </View>
            {i > 1 ? (
              <PressableScale role="button" accessibilityLabel={`Remove part ${i + 1}`} hitSlop={8} onPress={() => put(parts.filter((_, j) => j !== i))} style={styles.remove}>
                <IconSymbol name="xmark" size={14} color={ds.c.muted} />
              </PressableScale>
            ) : null}
          </View>
          {lines.length ? (
            <View style={styles.group}>
              <Caption tone="muted">What goes in this part</Caption>
              <View role="group" accessibilityLabel={`What goes in part ${i + 1}`} style={styles.chips}>
                {lines.map((l) => (
                  <WizardChip key={l.key} kind="checkbox" label={l.name} selected={linePart(parts, l.key, garnishes.has(l.key)) === i + 1} onPress={() => put(toggleLine(parts, i, l.key))} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.group}>
            <Caption tone="muted">How it’s made</Caption>
            {/* The part's own picks first, so the four chips before More show them. */}
            <PickStep label={`How part ${i + 1} is made`} ownLabel="Your own method" multi compact options={[...p.methods, ...options.filter((o) => !p.methods.some((m) => samePick(m, o)))]} selected={p.methods} onChange={(methods) => change(i, { methods })} />
          </View>
          {i > 0 ? (
            <View style={styles.group}>
              <Caption tone="muted">Then</Caption>
              <View role="radiogroup" accessibilityLabel={`How part ${i + 1} joins`} style={styles.chips}>
                {PART_JOINS.map((j) => (
                  <WizardChip key={j.value} label={j.label} selected={p.join === j.value} onPress={() => change(i, { join: p.join === j.value ? null : j.value })} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ))}
      {parts.length < MAX_PARTS ? (
        <PressableScale role="button" accessibilityLabel="Add a part" onPress={() => put(addPart(parts))} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="plus" size={16} color={ds.accentText} />
          <Body>Add a part</Body>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  switch: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.control, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 0 },
  card: { gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  number: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  remove: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed' },
});
