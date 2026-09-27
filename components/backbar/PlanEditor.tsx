import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field, Headline, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useZoneMutations } from '@/hooks/useBackBar';
import { freeSpot, kindFromName, nudgeRect, PLAN_STEP, rectColumns, resizeRect, zoneRect, type PlanRect } from '@/lib/backBar';
import type { BarZone } from '@/types/backBar';

function StepButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} style={[styles.step, { borderColor: ds.c.lineStrong }]}>
      <IconSymbol name={icon} size={18} color={ds.c.ink} />
    </PressableScale>
  );
}

/** Add a zone: one field, a kind guessed from the name, and the first free spot on the plan. */
export function AddZone({ barId, zones, onAdded }: { barId: string; zones: BarZone[]; onAdded: (zone: BarZone) => void }) {
  const { addZone } = useZoneMutations(barId);
  const [name, setName] = useState('');
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const taken = zones.map(zoneRect).filter((r): r is PlanRect => !!r);
    addZone.mutate(
      { name: trimmed, kind: kindFromName(trimmed), ...rectColumns(freeSpot(taken)) },
      {
        onSuccess: (zone) => {
          setName('');
          onAdded(zone);
        },
      }
    );
  };
  return (
    <View style={styles.addRow}>
      <View style={styles.flex}>
        <Field label="New zone" value={name} onChangeText={setName} placeholder="Fridge 3" maxLength={60} onSubmitEditing={add} returnKeyType="done" />
      </View>
      <Button label="Add a zone" icon="plus" variant="secondary" onPress={add} disabled={!name.trim() || addZone.isPending} />
    </View>
  );
}

/** Rename, describe, move and resize the selected zone. Every control is a button, so no dragging is needed. */
export function ZoneEditor({ barId, zone }: { barId: string; zone: BarZone }) {
  const { updateZone, isSavingZone } = useZoneMutations(barId);
  const [name, setName] = useState(zone.name);
  const [description, setDescription] = useState(zone.description ?? '');
  // Reads the zone's latest position at press time, so quick presses add up.
  const place = (change: (r: PlanRect) => PlanRect) => updateZone(zone.id, (z) => rectColumns(change(zoneRect(z) ?? freeSpot([]))));
  const dirty = name.trim() !== zone.name || (description.trim() || null) !== zone.description;

  return (
    <View style={styles.wrap}>
      <Headline>Edit {zone.name}</Headline>
      <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
      <Field label="Where it is" value={description} onChangeText={setDescription} placeholder="Under the back bar, second from the left. 4 °C." maxLength={500} multiline />
      <Button
        label="Save name and description"
        variant="secondary"
        disabled={!dirty || !name.trim() || isSavingZone}
        onPress={() => updateZone(zone.id, { name: name.trim(), description: description.trim() || null })}
      />
      <View style={styles.controls}>
        <View style={styles.group} role="group" aria-label="Move">
          <Caption tone="muted">Move</Caption>
          <View style={styles.steps}>
            <StepButton icon="chevron.left" label={`Move ${zone.name} left`} onPress={() => place((r) => nudgeRect(r, -PLAN_STEP, 0))} />
            <StepButton icon="chevron.up" label={`Move ${zone.name} up`} onPress={() => place((r) => nudgeRect(r, 0, -PLAN_STEP))} />
            <StepButton icon="chevron.down" label={`Move ${zone.name} down`} onPress={() => place((r) => nudgeRect(r, 0, PLAN_STEP))} />
            <StepButton icon="chevron.right" label={`Move ${zone.name} right`} onPress={() => place((r) => nudgeRect(r, PLAN_STEP, 0))} />
          </View>
        </View>
        <View style={styles.group} role="group" aria-label="Size">
          <Caption tone="muted">Size</Caption>
          <View style={styles.steps}>
            <StepButton icon="minus" label={`Make ${zone.name} narrower`} onPress={() => place((r) => resizeRect(r, -PLAN_STEP, 0))} />
            <StepButton icon="plus" label={`Make ${zone.name} wider`} onPress={() => place((r) => resizeRect(r, PLAN_STEP, 0))} />
            <StepButton icon="chevron.up" label={`Make ${zone.name} shorter`} onPress={() => place((r) => resizeRect(r, 0, -PLAN_STEP))} />
            <StepButton icon="chevron.down" label={`Make ${zone.name} taller`} onPress={() => place((r) => resizeRect(r, 0, PLAN_STEP))} />
          </View>
        </View>
      </View>
      <Caption tone="muted">Or tap an empty part of the plan to move it there.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.md },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl },
  group: { gap: space.xs },
  steps: { flexDirection: 'row', gap: space.sm },
  step: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
