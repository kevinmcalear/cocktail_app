import { StyleSheet, View } from 'react-native';

import { Caption, Chip } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBars } from '@/hooks/useBars';
import { PERSONAL_CONTEXT } from '@/lib/barContextFilter';

type Level = string | null;

interface BarAssignmentAccordionProps {
  barId: string | null;
  setBarId: (val: string | null) => void;
  overrideVisibility?: Level;
  setOverrideVisibility?: (val: Level) => void;
  overrideGeneric?: Level;
  setOverrideGeneric?: (val: Level) => void;
  overrideSpecific?: Level;
  setOverrideSpecific?: (val: Level) => void;
  overrideMeasurement?: Level;
  setOverrideMeasurement?: (val: Level) => void;
  overridePrep?: Level;
  setOverridePrep?: (val: Level) => void;
}

const DEFAULT = 'default';
const LEVELS = [
  { label: 'Bar default', value: DEFAULT },
  { label: 'Guest', value: '10' },
  { label: 'Employee', value: '20' },
  { label: 'Bartender', value: '30' },
  { label: 'Drink Creator', value: '35' },
  { label: 'Admin', value: '40' },
];

/** One choice of several, as a row of chips under its label. */
function ChoiceRow({ label, value, options, onChange }: { label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }) {
  return (
    <View style={styles.row}>
      <Caption tone="muted">{label}</Caption>
      <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}

/**
 * Who can see a drink or ingredient: the venue it belongs to (Personal if
 * none) and, per part of the spec, the lowest role that sees it, or the bar's
 * default. Sits inside the editors' access sheets.
 * ponytail: chips stand in until the role lens board draws these.
 */
export function BarAssignmentAccordion(p: BarAssignmentAccordionProps) {
  const { data: userBars } = useBars();
  const bars = [{ label: 'Personal', value: PERSONAL_CONTEXT }, ...(userBars ?? []).map((b) => ({ label: b.bars?.name ?? 'A bar', value: b.bar_id }))];
  const levels: [string, Level | undefined, ((v: Level) => void) | undefined][] = [
    ['Visibility', p.overrideVisibility, p.setOverrideVisibility],
    ['Generic ingredient', p.overrideGeneric, p.setOverrideGeneric],
    ['Specific brand', p.overrideSpecific, p.setOverrideSpecific],
    ['Measurement', p.overrideMeasurement, p.setOverrideMeasurement],
    ['Prep', p.overridePrep, p.setOverridePrep],
  ];
  return (
    <View style={styles.list}>
      <ChoiceRow label="Bar" value={p.barId || PERSONAL_CONTEXT} options={bars} onChange={(v) => p.setBarId(v === PERSONAL_CONTEXT ? null : v)} />
      {p.setOverrideVisibility ? <Caption tone="muted">Leave a level on Bar default to use the bar’s own rules.</Caption> : null}
      {levels.map(([label, value, set]) =>
        set ? <ChoiceRow key={label} label={`${label} level`} value={value || DEFAULT} options={LEVELS} onChange={(v) => set(v === DEFAULT ? null : v)} /> : null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  row: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
