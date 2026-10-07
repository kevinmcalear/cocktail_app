import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { samePick, type WizardPick } from '@/lib/drinkWizard';

import { WizardChip } from './WizardChrome';

/** How many chips show before "More". */
const FIRST = 8;

interface PickStepProps {
  label: string;
  options: WizardPick[];
  selected: WizardPick[];
  /** Any number, in the order tapped (methods); otherwise one, tapped again to clear. */
  multi?: boolean;
  onChange: (next: WizardPick[]) => void;
  /** "Your own method" */
  ownLabel: string;
}

/**
 * Big chips for a step's common choices (existing rows first, so nothing is
 * duplicated) and a field for your own, made when the drink is saved.
 */
export function PickStep({ label, options, selected, multi, onChange, ownLabel }: PickStepProps) {
  const [all, setAll] = useState(false);
  // Your own choices stay on the list once added.
  const extra = selected.filter((s) => !options.some((o) => samePick(o, s)));
  const list = [...extra, ...options];
  const shown = all ? list : list.slice(0, Math.max(FIRST, extra.length + selected.length));
  const order = (p: WizardPick) => selected.findIndex((s) => samePick(s, p));

  const toggle = (p: WizardPick) => {
    const at = order(p);
    if (multi) onChange(at >= 0 ? selected.filter((_, i) => i !== at) : [...selected, p]);
    else onChange(at >= 0 ? [] : [p]);
  };

  return (
    <View style={styles.stack}>
      <View role={multi ? 'group' : 'radiogroup'} accessibilityLabel={label} style={styles.chips}>
        {shown.map((p) => {
          // The order shows in the caption, not on the chip: a label that grows reflows the row under the next tap.
          return (
            <WizardChip
              key={p.id ?? `new:${p.name}`}
              kind={multi ? 'checkbox' : 'radio'}
              label={p.name}
              selected={order(p) >= 0}
              onPress={() => toggle(p)}
            />
          );
        })}
        {!all && list.length > shown.length ? <WizardChip label="More" kind="button" onPress={() => setAll(true)} /> : null}
      </View>
      {multi && selected.length > 1 ? <Caption tone="muted">{selected.map((s) => s.name).join(', then ')}</Caption> : null}
      <OwnField
        label={ownLabel}
        onAdd={(name) => {
          const hit = list.find((o) => samePick(o, { id: null, name }));
          const pick = hit ?? { id: null, name };
          if (order(pick) < 0) onChange(multi ? [...selected, pick] : [pick]);
        }}
      />
    </View>
  );
}

/** A one-line field with Add; Return adds too. */
export function OwnField({ label, onAdd, placeholder }: { label: string; onAdd: (name: string) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const name = text.trim();
    if (!name) return;
    onAdd(name);
    setText('');
  };
  return (
    <View style={styles.own}>
      <View style={styles.flex}>
        <Field label={label} value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" placeholder={placeholder} maxLength={60} />
      </View>
      <Button label="Add" variant="secondary" onPress={add} disabled={!text.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  own: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  flex: { flex: 1 },
});
