import { useDeferredValue, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, EquipmentThumb, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarKit, useSaveTool, type KitRow, type ToolChange } from '@/hooks/useBarKit';
import { useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { EQUIPMENT, equipmentById } from '@/lib/techniques/equipment';
import { kitCount, TOOL_LOCATION_LABEL } from '@/lib/venueKit';

import { KitAddSheet, KitChipGroup, useOpenKey, type KitQuestion } from './KitAddSheet';
import { SourceQuestion, trimmed, type KitSource } from './SourceQuestion';

const FAILED = 'Couldn’t save that. Check your connection and try again.';
const LOCATIONS = ['bar', 'prep'] as const;
/** Where a tool of ours usually lives: bar tools behind the bar, the rest in prep. */
const spotFor = (id: string) => (equipmentById(id)?.kind === 'bar' ? 'bar' : 'prep');

export interface ToolSheetProps {
  barId: string;
  visible: boolean;
  onClose: () => void;
  /** The tool to change; null adds one. */
  tool?: KitRow | null;
  /** A new tool already picked: one of ours by id (a wizard's "not in your kit, add it?"). More can be picked with it. */
  initialKey?: string | null;
  /** The question it opens on: 0 which tool, 1 where it comes from, 2 where it is. */
  startAt?: 0 | 1 | 2;
  onSaved?: () => void;
  /** Why it's wanted: "2 drinks are blended". */
  from?: string;
}

/**
 * Add tools, or change one: which tool, where it comes from, where it is.
 * Adding picks as many of ours as you like; the next two answers go on each.
 */
export function ToolSheet(props: ToolSheetProps) {
  return <ToolSheetBody key={useOpenKey(props.visible)} {...props} />;
}

function ToolSheetBody({ barId, visible, onClose, tool, initialKey, startAt = 0, onSaved, from }: ToolSheetProps) {
  const suppliers = useVenueSuppliers(barId).data ?? [];
  const have = (useBarKit(barId).data ?? []).flatMap((r) => (r.key && r.id !== tool?.id ? [r.key] : []));
  const save = useSaveTool(barId);
  const [step, setStep] = useState<number>(startAt);
  const [keys, setKeys] = useState<string[]>(tool ? (tool.key ? [tool.key] : []) : initialKey ? [initialKey] : []);
  const key = keys.length === 1 ? keys[0] : null;
  const [name, setName] = useState(tool?.name ?? '');
  const [own, setOwn] = useState(!!tool && !tool.key);
  const several = !own && keys.length > 1;
  const [term, setTerm] = useState('');
  const search = useDeferredValue(term).trim().toLowerCase();
  // What it said before: Skip leaves it so.
  const [saved] = useState<KitSource>(() => ({ source: tool?.source ?? null, supplier_id: tool?.supplier_id ?? null, note: tool?.note ?? '' }));
  const [src, setSrc] = useState<KitSource>(saved);
  const [location, setLocation] = useState<'bar' | 'prep' | null>((tool?.location as 'bar' | 'prep' | null) ?? (key ? spotFor(key) : null));
  const [count, setCount] = useState(tool?.count ? String(tool.count) : '');
  const { n, ok: countOk } = kitCount(count);

  // Ours not on the venue's list yet, matching the search; every one with none typed.
  // ponytail: the first dozen until a search narrows it; a browse by kind if a dozen isn't enough.
  const ours = EQUIPMENT.filter((e) => !have.includes(e.id) && (!search || e.name.toLowerCase().includes(search) || e.what.toLowerCase().includes(search))).slice(0, search ? 30 : 12);
  const picked = keys.flatMap((id) => equipmentById(id) ?? []);
  // Picked ones stay where they are; any the list doesn't show lead it.
  const shown = [...picked.filter((e) => !ours.includes(e)), ...ours];
  const pick = (id: string) => {
    const next = tool ? [id] : keys.includes(id) ? keys.filter((k) => k !== id) : [...keys, id];
    setKeys(next);
    setOwn(false);
    // Several go where each usually lives unless one place is picked for all.
    setLocation(next.length === 1 ? spotFor(next[0]) : null);
  };
  const finish = (source: KitSource, where: 'bar' | 'prep' | null, howMany: number | null) => {
    const origin = {
      source: source.source === 'bought' || source.source === 'ours' ? source.source : null,
      supplier_id: source.source === 'bought' ? source.supplier_id : null,
      note: trimmed(source.note),
    };
    const changes: ToolChange[] = several
      ? keys.map((k) => ({ ...origin, key: k, name: null, location: where ?? spotFor(k), count: null }))
      : [{ ...origin, id: tool?.id, key: own ? null : key, name: trimmed(name), location: where, count: howMany }];
    save.mutate(changes, {
      onSuccess: () => {
        onSaved?.();
        onClose();
      },
    });
  };

  const questions: KitQuestion[] = [
    {
      title: 'Which tool?',
      intro: own ? 'Anything not on our list: a bandsaw, a stamp with your logo.' : tool ? 'Search our list, or name your own.' : 'Pick every one you have, or name your own.',
      body: own ? (
        <View style={styles.stack}>
          <Field label="Its name" value={name} onChangeText={setName} placeholder="Ice stamp" maxLength={60} />
          <Chip label="Pick from our list instead" selected={false} onPress={() => setOwn(false)} />
        </View>
      ) : (
        <View style={styles.stack}>
          <Field label="Search tools" hideLabel icon="magnifyingglass" value={term} onChangeText={setTerm} placeholder="Jigger, sous vide, Lewis bag" autoCorrect={false} maxLength={60} />
          <View role={tool ? 'radiogroup' : 'group'} aria-label="Our tools" style={styles.chips}>
            {shown.map((e) => (
              <Chip key={e.id} label={e.name} multi={!tool} selected={keys.includes(e.id)} onPress={() => pick(e.id)} leading={<EquipmentThumb id={e.id} name={e.name} size={32} />} />
            ))}
            <Chip label="Name your own" selected={false} onPress={() => setOwn(true)} />
          </View>
          {key ? <Field label="What you call it, if it’s different" value={name} onChangeText={setName} placeholder={equipmentById(key)?.name} maxLength={60} /> : null}
        </View>
      ),
      next: 'Next',
      canNext: own ? !!name.trim() : keys.length > 0,
    },
    {
      title: 'Where does it come from?',
      body: <SourceQuestion kind="tool" value={src} onChange={setSrc} suppliers={suppliers} />,
      next: 'Next',
      onSkip: () => {
        setSrc(saved);
        setStep(2);
      },
    },
    {
      title: 'Where is it?',
      intro: several ? 'Leave it and each goes where it usually lives.' : 'If it helps whoever’s looking for it.',
      body: (
        <View style={styles.stack}>
          <KitChipGroup label="Where it is">
            {LOCATIONS.map((l) => (
              <Chip key={l} label={TOOL_LOCATION_LABEL[l]} selected={location === l} onPress={() => setLocation(location === l ? null : l)} />
            ))}
          </KitChipGroup>
          {several ? null : <Field label="How many, if it matters" value={count} onChangeText={setCount} placeholder="6" keyboardType="number-pad" maxLength={4} error={countOk ? undefined : 'A whole number, 1 to 9999.'} />}
        </View>
      ),
      next: tool ? 'Save' : several ? `Add the ${keys.length} tools` : 'Add the tool',
      canNext: several || countOk,
      onSkip: () => finish(src, (tool?.location as 'bar' | 'prep' | null) ?? null, tool?.count ?? null),
    },
  ];

  return (
    <KitAddSheet
      visible={visible}
      onClose={onClose}
      label={tool ? 'Change the tool' : 'Add tools'}
      step={step}
      total={3}
      question={questions[step]}
      onNext={() => (step < 2 ? setStep(step + 1) : finish(src, location, n))}
      saving={save.isPending}
      answered={tool ? undefined : { what: own ? name.trim() || 'Your own tool' : picked.map((e) => e.name).join(', ') || 'A tool', from, onChange: () => setStep(0) }}
      error={save.error ? ((save.error as { code?: string }).code === '23505' ? (several ? 'One of those is already in the kit. Check the list and try again.' : 'That tool is already in the kit. Open it there to change it.') : FAILED) : null}
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
