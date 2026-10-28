import { useDeferredValue, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, EquipmentThumb, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarKit, useSaveTool, type KitRow, type ToolChange } from '@/hooks/useBarKit';
import { useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { EQUIPMENT, equipmentById, equipmentMatches } from '@/lib/techniques/equipment';
import { kitCount, TOOL_LOCATION_LABEL } from '@/lib/venueKit';

import { KitAddSheet, KitChipGroup, useOpenKey, type KitQuestion } from './KitAddSheet';
import { SourceQuestion, trimmed, type KitSource } from './SourceQuestion';

const FAILED = 'Couldn’t save that. Check your connection and try again.';
const LOCATIONS = ['bar', 'prep'] as const;

export interface ToolSheetProps {
  barId: string;
  visible: boolean;
  onClose: () => void;
  /** The tool to change; null adds one. */
  tool?: KitRow | null;
  /** A new tool already picked: one of ours by id (a wizard's "not in your kit, add it?"). */
  initialKey?: string | null;
  /** The question it opens on: 0 which tool, 1 where it comes from, 2 where it is. */
  startAt?: 0 | 1 | 2;
  onSaved?: () => void;
  /** Why it's wanted: "2 drinks are blended". */
  from?: string;
}

/** Add a tool, or change one: which tool, where it comes from, where it is. */
export function ToolSheet(props: ToolSheetProps) {
  return <ToolSheetBody key={useOpenKey(props.visible)} {...props} />;
}

function ToolSheetBody({ barId, visible, onClose, tool, initialKey, startAt = 0, onSaved, from }: ToolSheetProps) {
  const suppliers = useVenueSuppliers(barId).data ?? [];
  const have = (useBarKit(barId).data ?? []).flatMap((r) => (r.key && r.id !== tool?.id ? [r.key] : []));
  const save = useSaveTool(barId);
  const [step, setStep] = useState<number>(startAt);
  const [key, setKey] = useState<string | null>(tool ? tool.key : (initialKey ?? null));
  const [name, setName] = useState(tool?.name ?? '');
  const [own, setOwn] = useState(!!tool && !tool.key);
  const [term, setTerm] = useState('');
  const search = useDeferredValue(term).trim().toLowerCase();
  // What it said before: Skip leaves it so.
  const [saved] = useState<KitSource>(() => ({ source: tool?.source ?? null, supplier_id: tool?.supplier_id ?? null, note: tool?.note ?? '' }));
  const [src, setSrc] = useState<KitSource>(saved);
  const [location, setLocation] = useState<'bar' | 'prep' | null>((tool?.location as 'bar' | 'prep' | null) ?? (key ? (equipmentById(key)?.kind === 'bar' ? 'bar' : 'prep') : null));
  const [count, setCount] = useState(tool?.count ? String(tool.count) : '');
  const { n, ok: countOk } = kitCount(count);

  // Ours not on the venue's list yet, matching the search; every one with none typed.
  const ours = EQUIPMENT.filter((e) => e.id !== key && !have.includes(e.id) && (!search || equipmentMatches(e, search)));
  const picked = key ? equipmentById(key) : undefined;
  // ponytail: the first dozen until a search narrows it; a browse by kind if a dozen isn't enough.
  const shown = [...(picked ? [picked] : []), ...ours].slice(0, search ? 30 : 12);
  const pick = (id: string) => {
    setKey(id);
    setOwn(false);
    setLocation(equipmentById(id)?.kind === 'bar' ? 'bar' : 'prep');
  };
  const finish = (source: KitSource, where: 'bar' | 'prep' | null, howMany: number | null) => {
    const change: ToolChange = {
      id: tool?.id,
      key: own ? null : key,
      name: trimmed(name),
      location: where,
      count: howMany,
      source: source.source === 'bought' || source.source === 'ours' ? source.source : null,
      supplier_id: source.source === 'bought' ? source.supplier_id : null,
      note: trimmed(source.note),
    };
    save.mutate(change, {
      onSuccess: () => {
        onSaved?.();
        onClose();
      },
    });
  };

  const questions: KitQuestion[] = [
    {
      title: 'Which tool?',
      intro: own ? 'Anything not on our list: a bandsaw, a stamp with your logo.' : 'Search our list, or name your own.',
      body: own ? (
        <View style={styles.stack}>
          <Field label="Its name" value={name} onChangeText={setName} placeholder="Ice stamp" maxLength={60} />
          <Chip label="Pick from our list instead" selected={false} onPress={() => setOwn(false)} />
        </View>
      ) : (
        <View style={styles.stack}>
          <Field label="Search tools" hideLabel icon="magnifyingglass" value={term} onChangeText={setTerm} placeholder="Jigger, sous vide, ice machine" autoCorrect={false} maxLength={60} />
          <View role="radiogroup" aria-label="Our tools" style={styles.chips}>
            {shown.map((e) => (
              <Chip key={e.id} label={e.name} selected={key === e.id} onPress={() => pick(e.id)} leading={<EquipmentThumb id={e.id} name={e.name} size={32} />} />
            ))}
            <Chip label="Name your own" selected={false} onPress={() => setOwn(true)} />
          </View>
          {key ? <Field label="What you call it, if it’s different" value={name} onChangeText={setName} placeholder={equipmentById(key)?.name} maxLength={60} /> : null}
        </View>
      ),
      next: 'Next',
      canNext: own ? !!name.trim() : !!key,
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
      intro: 'If it helps whoever’s looking for it.',
      body: (
        <View style={styles.stack}>
          <KitChipGroup label="Where it is">
            {LOCATIONS.map((l) => (
              <Chip key={l} label={TOOL_LOCATION_LABEL[l]} selected={location === l} onPress={() => setLocation(location === l ? null : l)} />
            ))}
          </KitChipGroup>
          <Field label="How many, if it matters" value={count} onChangeText={setCount} placeholder="6" keyboardType="number-pad" maxLength={4} error={countOk ? undefined : 'A whole number, 1 to 9999.'} />
        </View>
      ),
      next: tool ? 'Save' : 'Add the tool',
      canNext: countOk,
      onSkip: () => finish(src, (tool?.location as 'bar' | 'prep' | null) ?? null, tool?.count ?? null),
    },
  ];

  return (
    <KitAddSheet
      visible={visible}
      onClose={onClose}
      label={tool ? 'Change the tool' : 'Add a tool'}
      step={step}
      total={3}
      question={questions[step]}
      onNext={() => (step < 2 ? setStep(step + 1) : finish(src, location, n))}
      saving={save.isPending}
      answered={tool ? undefined : { what: own ? name.trim() || 'Your own tool' : ((key && equipmentById(key)?.name) ?? 'A tool'), from, onChange: () => setStep(0) }}
      error={save.error ? ((save.error as { code?: string }).code === '23505' ? 'That tool is already in the kit. Open it there to change it.' : FAILED) : null}
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
