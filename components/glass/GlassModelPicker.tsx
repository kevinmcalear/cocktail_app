import { useDeferredValue, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useGlassModelSearch, type GlassModel } from '@/hooks/useGlassModels';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { draftSketchInputs } from '@/lib/sketch/draft';
import type { SketchGlass } from '@/lib/sketch/types';

// The types a bar mostly looks for first; the rest wait behind More.
const FIRST_TYPES: SketchGlass[] = ['coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'flute'];
const MORE_TYPES: SketchGlass[] = ['fizz', 'spritz', 'snifter', 'julep', 'tiki', 'mug'];

// An empty glass, sketched (as the glass form draws it).
const EMPTY = draftSketchInputs({ name: '', lines: [] });

/** A glass drawn on paper, small. */
export function GlassThumb({ glass, variant, size = 48 }: { glass: SketchGlass; variant: string | null; size?: number }) {
  const ds = useDs();
  const inputs = useMemo(() => ({ ...EMPTY, glass, variant }), [glass, variant]);
  return (
    <View style={[styles.paper, { width: size, height: size, backgroundColor: ds.c.paper }]} aria-hidden>
      <SketchDrawing inputs={inputs} seed="bar-glass" detail="thumb" />
    </View>
  );
}

interface RowProps {
  model: GlassModel;
  /** Shown after the maker: "Little Rye pours this". */
  note?: string | null;
  first: boolean;
  /** Set for a pick list (a radio); unset for a plain button. */
  selected?: boolean;
  onPress: () => void;
}

/** One maker's glass: its drawing, name, maker and material, and its size. */
export function GlassModelRow({ model, note, first, selected, onPress }: RowProps) {
  const ds = useDs();
  const material = model.material ? model.material[0].toUpperCase() + model.material.slice(1) : null;
  const sub = [model.maker?.display_name, material, note].filter(Boolean).join(' · ');
  const size = model.capacity_ml ? `${Math.round(model.capacity_ml)} ml` : null;
  return (
    <PressableScale
      role={selected === undefined ? 'button' : 'radio'}
      aria-checked={selected}
      accessibilityLabel={[model.name, size, sub].filter(Boolean).join(', ')}
      onPress={onPress}
      style={[
        styles.row,
        first
          ? null
          : {
              borderTopColor: ds.c.line,
              borderTopWidth: StyleSheet.hairlineWidth,
            },
      ]}
    >
      <GlassThumb glass={model.glass} variant={model.variant} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{model.name}</Body>
        <Caption tone="muted" numberOfLines={1}>
          {sub}
        </Caption>
      </View>
      {size ? <Caption tone="muted">{size}</Caption> : null}
      {selected ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
    </PressableScale>
  );
}

interface PickerProps {
  /** The venue's own models: listed first and marked. */
  venueModelIds?: readonly string[];
  venueName?: string;
  initialGlass?: SketchGlass | null;
  onPick: (model: GlassModel) => void;
  /** "Not listed? Describe it yourself". */
  onDescribe?: () => void;
}

/**
 * "Which glass is it?" (tools-glassware-find-phone): search the makers'
 * catalogs by maker, name, series or item code, narrowed to a type. The
 * venue's own glasses come first.
 */
export function GlassModelPicker({ venueModelIds = [], venueName, initialGlass = null, onPick, onDescribe }: PickerProps) {
  const ds = useDs();
  const [term, setTerm] = useState('');
  const [glass, setGlass] = useState<SketchGlass | null>(initialGlass);
  const [more, setMore] = useState(!!initialGlass && MORE_TYPES.includes(initialGlass));
  const search = useDeferredValue(term);
  const { data = [], isFetching, error } = useGlassModelSearch(search, glass);
  const ours = new Set(venueModelIds);
  const models = [...data.filter((m) => ours.has(m.id)), ...data.filter((m) => !ours.has(m.id))];
  const looking = search.trim().length >= 2 || !!glass;
  const types = more ? [...FIRST_TYPES, ...MORE_TYPES] : FIRST_TYPES;

  return (
    <View style={styles.stack}>
      <Field
        label="Search glasses"
        hideLabel
        icon="magnifyingglass"
        value={term}
        onChangeText={setTerm}
        placeholder="Maker, name or item code"
        autoCorrect={false}
        maxLength={80}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        <View role="radiogroup" aria-label="Type" style={styles.chips}>
          <Chip label="All" selected={!glass} onPress={() => setGlass(null)} />
          {types.map((g) => (
            <Chip key={g} label={GLASS_TYPE_LABEL[g]} selected={g === glass} onPress={() => setGlass(g)} />
          ))}
          {more ? null : <Chip label="More" selected={false} onPress={() => setMore(true)} />}
        </View>
      </ScrollView>
      {models.length ? (
        <View role="list" style={[styles.list, { backgroundColor: ds.c.surface }]}>
          {models.map((m, i) => (
            <GlassModelRow
              key={m.id}
              model={m}
              first={i === 0}
              note={ours.has(m.id) ? `${venueName ?? 'The venue'} pours this` : null}
              onPress={() => onPick(m)}
            />
          ))}
        </View>
      ) : looking && !isFetching ? (
        <Body tone="muted">{error ? 'Couldn’t search the glasses. Check your connection and try again.' : 'No maker lists a glass like that yet.'}</Body>
      ) : !looking ? (
        <Caption tone="muted">Type a maker or a name, or pick a type.</Caption>
      ) : null}
      {models.length ? (
        <Caption tone="muted">{`From the makers’ own catalogs. ${models.length === 40 ? 'The first 40; type more to narrow it.' : ''}`.trim()}</Caption>
      ) : null}
      {onDescribe ? <Button label="Not listed? Describe it yourself" variant="ghost" onPress={onDescribe} style={styles.start} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  chips: { flexDirection: 'row', gap: space.xs },
  list: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    paddingHorizontal: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.sm,
  },
  flex: { flex: 1, minWidth: 0 },
  paper: {
    borderRadius: radius.control,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  start: { alignSelf: 'flex-start' },
});
