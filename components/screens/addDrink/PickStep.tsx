import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { samePick, type WizardPick } from '@/lib/drinkWizard';

import { KindQuestion, pickedKind, type KindOf } from './KindQuestion';
import { Eyebrow, WizardChip } from './WizardChrome';

/** How many chips show before "More": the canvas draws seven glasses, then More. */
const FIRST = 7;
/** The desktop page's rows (make-create-desktop): four, then More. */
const COMPACT = 4;

interface PickStepProps {
  label: string;
  options: WizardPick[];
  selected: WizardPick[];
  /** Any number, in the order tapped (methods); otherwise one, tapped again to clear. */
  multi?: boolean;
  onChange: (next: WizardPick[]) => void;
  /** "Your own method" */
  ownLabel: string;
  /** Our guess from the spec ("Shake"), offered first while nothing is picked. */
  suggested?: string | null;
  /** Why we guess it: "It has citrus, so it's shaken". */
  why?: string | null;
  /** Between the chips and the field for your own: the glass's shapes. */
  children?: ReactNode;
  /** The venue's own (its glasses): listed first under "Your …", then the rest under "Other …". */
  mine?: { has: (p: WizardPick) => boolean; label: string; restLabel: string };
  /** One row on the desktop page: four chips, then More shows the rest and the field for your own. */
  compact?: boolean;
  /** What a chip says, when it says more than the pick's name ("No ice (served up)"). */
  chipLabel?: (p: WizardPick) => string;
  /** A glass or ice: a new name typed in asks what kind it is. */
  kindOf?: KindOf;
}

/**
 * Big chips for a step's common choices (existing rows first, so nothing is
 * duplicated) and a field for your own, made when the drink is saved.
 */
export function PickStep({ label, options, selected, multi, onChange, ownLabel, suggested, why, children, mine, compact, chipLabel, kindOf }: PickStepProps) {
  const [all, setAll] = useState(false);
  // Your own choices stay on the list once added.
  const extra = selected.filter((s) => !options.some((o) => samePick(o, s)));
  // The guess leads the list, so it's the first chip and never a second copy.
  const guess = suggested && !selected.length ? options.find((o) => samePick(o, { id: null, name: suggested })) ?? { id: null, name: suggested } : null;
  const listed = [...(guess ? [guess] : []), ...extra, ...options.filter((o) => !guess || !samePick(o, guess))];
  // The venue's own lead, in the same order among themselves.
  const list = mine ? [...listed.filter(mine.has), ...listed.filter((p) => !mine.has(p))] : listed;
  const shown = all ? list : list.slice(0, Math.max(compact ? COMPACT : FIRST, extra.length + selected.length));
  const ownCount = mine ? shown.filter(mine.has).length : 0;
  const order = (p: WizardPick) => selected.findIndex((s) => samePick(s, p));

  const toggle = (p: WizardPick) => {
    const at = order(p);
    if (multi) onChange(at >= 0 ? selected.filter((_, i) => i !== at) : [...selected, p]);
    else onChange(at >= 0 ? [] : [p]);
  };

  // The order shows in the caption, not on the chip: a label that grows reflows the row under the next tap.
  const chip = (p: WizardPick) => (
    <WizardChip
      key={p.id ?? `new:${p.name}`}
      kind={multi ? 'checkbox' : 'radio'}
      label={chipLabel?.(p) ?? p.name}
      selected={order(p) >= 0}
      suggested={!!guess && samePick(p, guess)}
      onPress={() => toggle(p)}
    />
  );
  const more = !all && (list.length > shown.length || compact) ? <WizardChip label="More" kind="button" onPress={() => setAll(true)} /> : null;
  const rest = shown.slice(ownCount);

  return (
    <View style={styles.stack}>
      <View role={multi ? 'group' : 'radiogroup'} accessibilityLabel={label} style={ownCount ? styles.groups : styles.chips}>
        {mine && ownCount ? (
          <>
            <Eyebrow>{mine.label}</Eyebrow>
            <View style={styles.chips}>{shown.slice(0, ownCount).map(chip)}</View>
            {rest.length || more ? <Eyebrow>{mine.restLabel}</Eyebrow> : null}
            {rest.length || more ? (
              <View style={styles.chips}>
                {rest.map(chip)}
                {more}
              </View>
            ) : null}
          </>
        ) : (
          <>
            {shown.map(chip)}
            {more}
          </>
        )}
      </View>
      {guess && why ? <Caption tone="muted">{`Suggested: ${why}.`}</Caption> : null}
      {multi && selected.length > 1 ? <Caption tone="muted">{selected.map((s) => s.name).join(', then ')}</Caption> : null}
      {children}
      {compact && !all ? null : (
        <OwnField
          label={ownLabel}
          ask={kindOf ? { of: kindOf, known: (name) => list.some((o) => samePick(o, { id: null, name })) } : undefined}
          onAdd={(name, kind) => {
            const hit = list.find((o) => samePick(o, { id: null, name }));
            const pick = hit ?? { id: null, name, ...(kind !== undefined ? { kind } : {}) };
            if (order(pick) < 0) onChange(multi ? [...selected, pick] : [pick]);
          }}
        />
      )}
    </View>
  );
}

interface OwnFieldProps {
  label: string;
  /** With `ask`, a new name's kind (null for Not sure); unset for a name that's known. */
  onAdd: (name: string, kind?: string | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** A glass or ice: a name that isn't `known` asks what kind it is before it's added. */
  ask?: { of: KindOf; known: (name: string) => boolean };
}

/** A one-line field with Add; Return adds too. */
export function OwnField({ label, onAdd, placeholder, autoFocus, ask }: OwnFieldProps) {
  const [text, setText] = useState('');
  // Unset follows the guess from the name until a kind is tapped.
  const [kind, setKind] = useState<string | null | undefined>(undefined);
  const name = text.trim();
  const asking = !!ask && !!name && !ask.known(name);
  const add = () => {
    if (!name) return;
    onAdd(name, asking ? pickedKind(ask.of, name, kind) : undefined);
    setText('');
    setKind(undefined);
  };
  return (
    <View style={styles.field}>
      <View style={styles.own}>
        <View style={styles.flex}>
          <Field label={label} value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" placeholder={placeholder} maxLength={60} autoFocus={autoFocus} />
        </View>
        <Button label="Add" variant="secondary" onPress={add} disabled={!name} />
      </View>
      {asking ? <KindQuestion of={ask.of} name={name} value={kind} onChange={setKind} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  groups: { gap: space.sm },
  own: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  field: { gap: space.md },
  flex: { flex: 1 },
});
