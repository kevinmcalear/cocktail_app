import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { radius, space } from '@/constants/tokens';
import { methodIceLabel, type WizardPick } from '@/lib/drinkWizard';
import { iceKind } from '@/lib/iceBuild';
import { isVenueIce } from '@/lib/venueKit';

import { PickStep } from './PickStep';

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
  const kind = iceKind(value);
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
