import { useDeferredValue, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { GLASS_SEARCH_LIMIT, glassModelMaterial, glassModelSize, useGlassModelSearch, type GlassModel } from '@/hooks/useGlassModels';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { draftSketchInputs } from '@/lib/sketch/draft';
import type { GlassOutline } from '@/lib/sketch/outline';
import type { SketchGlass } from '@/lib/sketch/types';

// The types a bar mostly looks for first; the rest wait behind More.
export const FIRST_TYPES: SketchGlass[] = ['coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'flute'];
export const MORE_TYPES: SketchGlass[] = ['fizz', 'spritz', 'snifter', 'shot', 'cordial', 'julep', 'tiki', 'mug'];

// An empty glass, sketched (as the glass form draws it).
const EMPTY = draftSketchInputs({ name: '', lines: [] });

/** A glass drawn on paper, small: in its own traced shape when it has one (Draw my glass). */
export function GlassThumb({ glass, variant, outline, size = 48 }: { glass: SketchGlass; variant: string | null; outline?: GlassOutline | null; size?: number }) {
  const ds = useDs();
  const inputs = useMemo(() => ({ ...EMPTY, glass, variant, ...(outline ? { outline } : {}) }), [glass, variant, outline]);
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

/** One maker's glass: its drawing, name, maker, designer and material, and its size. */
export function GlassModelRow({ model, note, first, selected, onPress }: RowProps) {
  const ds = useDs();
  const sub = [model.maker?.display_name, model.designer, glassModelMaterial(model), note].filter(Boolean).join(' · ');
  const size = glassModelSize(model);
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
      <GlassThumb glass={model.glass} variant={model.variant} outline={model.outline} />
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
  /** What the search starts with: the maker a bar wrote for a glass it described. */
  initialTerm?: string;
  /** Glasses of this type come first, without hiding the rest. */
  preferGlass?: SketchGlass | null;
  onPick: (model: GlassModel) => void;
  /** "Not listed? Describe it yourself". */
  onDescribe?: () => void;
  describeLabel?: string;
  /** Draw my glass: offered beside Name your own (onDescribe) for a glass the catalog doesn't have. */
  onDraw?: () => void;
}

/**
 * "Which glass is it?" (tools-glassware-find-phone): search the makers'
 * catalogs by maker, name, series or item code, narrowed to a type. The
 * venue's own glasses come first.
 */
export function GlassModelPicker({
  venueModelIds = [],
  venueName,
  initialGlass = null,
  initialTerm = '',
  preferGlass = null,
  onPick,
  onDescribe,
  describeLabel = 'Not listed? Describe it yourself',
  onDraw,
}: PickerProps) {
  const ds = useDs();
  const [term, setTerm] = useState(initialTerm);
  const [glass, setGlass] = useState<SketchGlass | null>(initialGlass);
  const [more, setMore] = useState(!!initialGlass && MORE_TYPES.includes(initialGlass));
  const search = useDeferredValue(term);
  const { data = [], isFetching, error } = useGlassModelSearch(search, glass);
  const ours = new Set(venueModelIds);
  // The venue's own first, then the preferred type; the search's order otherwise (sort is stable).
  const rank = (m: GlassModel) => (ours.has(m.id) ? 0 : 2) + (m.glass === preferGlass ? 0 : 1);
  const models = [...data].sort((a, b) => rank(a) - rank(b));
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
        placeholder="Maker, name, designer or item code"
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
        <Body tone="muted">
          {error
            ? 'Couldn’t search the glasses. Check your connection and try again.'
            : onDraw && search.trim()
              ? `No glass in the catalog matches “${search.trim()}”. Close spellings were checked too.`
              : 'No maker lists a glass like that yet.'}
        </Body>
      ) : !looking ? (
        <Caption tone="muted">Type a maker or a name, or pick a type.</Caption>
      ) : null}
      {models.length ? (
        <Caption tone="muted">
          {`From the makers’ own catalogs. ${data.length >= GLASS_SEARCH_LIMIT ? `The first ${GLASS_SEARCH_LIMIT}; type more to narrow it.` : ''}`.trim()}
        </Caption>
      ) : null}
      {onDraw ? (
        <View style={[styles.draw, { backgroundColor: ds.c.surface }]}>
          <View style={styles.drawHead}>
            <IconSymbol name="camera.fill" size={20} color={ds.c.ink} />
            <Body style={styles.flex}>Draw my glass</Body>
          </View>
          <Caption tone="muted">Take a photo and give us one number. We trace its real shape, the same way every glass in the catalog was drawn.</Caption>
          <View style={styles.drawButtons}>
            <Button label="Draw my glass" onPress={onDraw} />
            {onDescribe ? <Button label="Name your own" variant="secondary" onPress={onDescribe} /> : null}
          </View>
        </View>
      ) : onDescribe ? (
        <Button label={describeLabel} variant="ghost" onPress={onDescribe} style={styles.start} />
      ) : null}
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
  draw: { gap: space.sm, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  drawHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  drawButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
});
