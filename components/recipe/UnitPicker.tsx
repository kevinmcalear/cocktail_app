import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DsText, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { RECIPE_UNITS, isKnownUnit, unitLabel, type RecipeUnit } from '@/lib/units';
import { useSettingsStore } from '@/store/useSettingsStore';

const GROUPS: { group: RecipeUnit['group']; title: string }[] = [
  { group: 'volume', title: 'Pour' },
  { group: 'weight', title: 'Weight' },
  { group: 'count', title: 'Count' },
];

/**
 * A recipe line's unit: a pill with the unit in mono (make-create-house-line),
 * opening a sheet of every unit as chips, grouped.
 */
export function UnitPicker({ value, onChange }: { value: string; onChange: (unit: string) => void }) {
  const ds = useDs();
  const defaultUnit = useSettingsStore((s) => s.defaultUnit);
  const [open, setOpen] = useState(false);
  const current = value || defaultUnit;
  // ponytail: keep legacy free-text units visible until user picks a known one
  const options: RecipeUnit[] = current && !isKnownUnit(current) ? [{ value: current, label: current, group: 'volume' }, ...RECIPE_UNITS] : RECIPE_UNITS;

  return (
    <>
      <PressableScale
        onPress={() => setOpen(true)}
        role="button"
        aria-expanded={open}
        accessibilityLabel={`Unit: ${unitLabel(current)}`}
        style={[styles.trigger, { borderColor: ds.c.lineStrong }]}
      >
        <DsText variant="spec" numberOfLines={1} style={styles.mono}>
          {unitLabel(current)}
        </DsText>
        <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
      </PressableScale>

      <MenuSheet visible={open} onClose={() => setOpen(false)} title="Unit" plain>
        {GROUPS.map(({ group, title }) => (
          <View key={group} style={styles.group}>
            <Caption tone="muted">{title}</Caption>
            <View role="radiogroup" aria-label={title} style={styles.chips}>
              {options
                .filter((u) => u.group === group)
                .map((u) => (
                  <Chip
                    key={u.value}
                    label={u.label}
                    selected={u.value === current}
                    onPress={() => {
                      onChange(u.value);
                      setOpen(false);
                    }}
                  />
                ))}
            </View>
          </View>
        ))}
      </MenuSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minWidth: 64, height: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  mono: { fontFamily: fontFamilies.monoMedium },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
