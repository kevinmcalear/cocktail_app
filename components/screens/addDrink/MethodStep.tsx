import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { TellUs, type TellUsAbout } from '@/components/feedback/TellUs';
import { radius, space } from '@/constants/tokens';
import { METHOD_GROUPS, methodDetail, methodIceLabel, samePick, type StepProps, type WizardPick } from '@/lib/drinkWizard';
import { iceKind } from '@/lib/iceBuild';
import { isVenueIce } from '@/lib/venueKit';

import { MethodParts, PartsSwitch } from './MethodParts';
import { OwnField, PickStep } from './PickStep';
import { Eyebrow, WizardChip } from './WizardChrome';

interface MethodStepProps extends StepProps {
  /** Every method we know (choiceList): the groups use the existing rows. */
  options: WizardPick[];
  /** Our guess from the spec ("Shake"), marked while nothing is picked. */
  suggested?: string | null;
  why?: string | null;
  /** Under the steps, above the chips: the foamer hint. */
  hint?: ReactNode;
  /** Under the list: "Doing something different? Tell us", sent with the drink and bar. */
  tellUs?: TellUsAbout;
}

/**
 * How it's made: the picks first, as numbered steps in the order tapped
 * ("1 Dry shake ... 15 s, no ice"), then every method in two groups (Mix,
 * Air and texture), and a field for your own. Made in parts (Q20b), each
 * part has its own instead (MethodParts).
 */
export function MethodStep({ options, draft, set, suggested, why, hint, tellUs }: MethodStepProps) {
  const ds = useDs();
  const selected = draft.methods;
  const onChange = (methods: WizardPick[]) => set({ methods });
  const find = (name: string) => options.find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
  const order = (p: WizardPick) => selected.findIndex((s) => samePick(s, p));
  const toggle = (p: WizardPick) => {
    const at = order(p);
    onChange(at >= 0 ? selected.filter((_, i) => i !== at) : [...selected, p]);
  };
  const guess = suggested && !selected.length ? find(suggested) : null;
  const grouped = METHOD_GROUPS.map((g) => ({ label: g.label, picks: g.methods.map(find) }));
  // Your own, and anything from a classic's spec outside the groups, stay on as chips.
  const own = selected.filter((s) => !grouped.some((g) => g.picks.some((p) => samePick(p, s))));
  if (own.length) grouped.push({ label: 'Your own', picks: own });

  const inParts = !!draft.parts?.length;
  return (
    <View style={styles.stack}>
      {!inParts && selected.length ? (
        <View role="list" aria-label="In order" style={styles.steps}>
          {selected.map((m, i) => {
            const detail = methodDetail(m.name);
            return (
              <View key={m.id ?? `new:${m.name}`} role="listitem" style={[styles.step, { backgroundColor: ds.c.surface }]}>
                <View style={[styles.number, { backgroundColor: ds.accentFill.fill }]}>
                  <DsText variant="caption" color={ds.accentFill.text}>
                    {String(i + 1)}
                  </DsText>
                </View>
                <Body style={styles.flex}>{m.name}</Body>
                {detail ? <Caption tone="muted">{detail}</Caption> : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {hint}
      <PartsSwitch draft={draft} set={set} />
      {inParts ? <MethodParts draft={draft} set={set} options={options} /> : null}
      {inParts ? null : grouped.map((g) => (
        <View key={g.label} style={styles.group}>
          <Eyebrow>{g.label}</Eyebrow>
          <View role="group" accessibilityLabel={g.label} style={styles.chips}>
            {g.picks.map((p) => (
              <WizardChip
                key={p.id ?? `new:${p.name}`}
                kind="checkbox"
                label={p.name}
                selected={order(p) >= 0}
                suggested={!!guess && samePick(p, guess)}
                onPress={() => toggle(p)}
              />
            ))}
          </View>
        </View>
      ))}
      {!inParts && guess && why ? <Caption tone="muted">{`Suggested: ${why}.`}</Caption> : null}
      {!inParts && selected.length > 1 ? <Caption tone="muted">{selected.map((s, i) => (i ? s.name.toLowerCase() : s.name)).join(', then ')}</Caption> : null}
      {inParts ? null : (
        <OwnField
          label="Your own method"
          onAdd={(name) => {
            const pick = [...options, ...own].find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
            if (order(pick) < 0) onChange([...selected, pick]);
          }}
        />
      )}
      {tellUs ? <TellUs screen="Adding a drink › Method" line="We’ll add your method to the app." {...tellUs} /> : null}
    </View>
  );
}

interface MethodIceLineProps {
  methods: readonly WizardPick[];
  /** What it's mixed with (lib/drinkWizard.ts withMethodIce: cubes, or the venue's, until changed). */
  value: WizardPick | null;
  options: WizardPick[];
  /** The venue's ice by name, listed first in the sheet under its name. */
  barIce?: readonly string[];
  venueName?: string | null;
  onChange: (ice: WizardPick) => void;
}

/**
 * One line under the method (Q21 + E24, 26 Oct): "Shaken with cubes", with
 * Change opening the ice list. None for a drink built in the glass.
 */
export function MethodIceLine({ methods, value, options, barIce = [], venueName, onChange }: MethodIceLineProps) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const label = methodIceLabel(methods.map((m) => m.name));
  if (!label || !value) return null;
  const kind = iceKind(value.name);
  const mine = barIce.length ? { has: (p: WizardPick) => isVenueIce(barIce, p.name), label: venueName ? `${venueName}’s ice` : 'Your ice', restLabel: 'Other ice' } : undefined;
  return (
    <View style={[styles.made, { backgroundColor: ds.c.surface }]}>
      {kind && kind !== 'none' ? <IceThumb kind={kind} size={28} /> : null}
      <Body style={styles.flex} numberOfLines={1}>{`${label} ${value.name.toLowerCase()}`}</Body>
      <Button label="Change" size="sm" variant="ghost" accessibilityLabel={`Change what it’s ${label.toLowerCase()}`} onPress={() => setOpen(true)} />
      <Sheet style={styles.sheet} visible={open} onClose={() => setOpen(false)} accessibilityLabel={label} header={<Headline role="heading">{label}</Headline>} keyboard>
        <SheetScrollView contentContainerStyle={styles.sheetBody}>
          <PickStep
            label={label}
            ownLabel="Other ice"
            options={options}
            selected={[value]}
            mine={mine}
            onChange={([ice]) => {
              if (ice) onChange(ice);
              setOpen(false);
            }}
          />
        </SheetScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  made: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingLeft: space.md + 2, paddingRight: space.xs, borderRadius: radius.control, borderCurve: 'continuous' },
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  sheetBody: { gap: space.lg, paddingBottom: space.lg },
  steps: { gap: space.xs + 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.md + 2, borderRadius: radius.control, borderCurve: 'continuous' },
  number: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
