import { useDeferredValue, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, Chip, Field, Headline, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { SketchGlassPicker } from '@/components/cocktail/SketchGlassPicker';
import { GlassModelRow } from '@/components/glass/GlassModelPicker';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useGlassModelSearch, type GlassModel } from '@/hooks/useGlassModels';
import { KindQuestion, pickedKind } from '@/components/screens/addDrink/KindQuestion';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { itemGlass } from '@/supabase/functions/_shared/sketch';

import type { DrinkEditor as Editor } from './EditParts';

const SHEET_PAD = { paddingHorizontal: space.xl, paddingBottom: space.xxl };
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
// How many makers' glasses of the drink's type show before "Every coupe makers list".
const FEW = 3;

/**
 * The drink editor's Glass sheet (drink-edit-glass-sheet): the venue's real
 * glasses first, then makers' glasses of the drink's type (or whatever was
 * typed), then the plain shapes. A real glass brings its shape and size.
 */
export function GlassPickSheet({ editor, itemId, onClose }: { editor: Editor; itemId: string | null; onClose: () => void }) {
  const ds = useDs();
  const [term, setTerm] = useState('');
  const [adding, setAdding] = useState('');
  // A new glass's kind: unset follows the guess from its name.
  const [kind, setKind] = useState<string | null | undefined>(undefined);
  const [all, setAll] = useState(false);
  const search = useDeferredValue(term.trim());
  const searching = search.length >= 2;
  // Only a published drink names a real glass; a draft picks a shape.
  const model = 'glassModel' in editor ? editor.glassModel : null;
  const canModel = 'setGlassModel' in editor;
  const shape = editor.glassware.find((g) => g.id === editor.glasswareId) ?? null;
  const glassType = model?.glass ?? itemGlass(shape);
  const venue = useActiveVenue().venues.find((v) => v.id === editor.barId);
  const { data: barGlasses = [] } = useBarGlassware(canModel ? editor.barId : null);
  const ours = barGlasses.flatMap((g) => (g.model ? [g.model] : []));
  const { data: found = [], isFetching } = useGlassModelSearch(searching ? search : '', searching ? null : glassType, { enabled: canModel });
  const oursIds = new Set(ours.map((m) => m.id));
  // The drink's own glass leads the makers' list when it isn't one of the venue's.
  const current = model && !oursIds.has(model.id) && !searching ? [model] : [];
  const makers = [...current, ...found.filter((m) => !oursIds.has(m.id) && m.id !== current[0]?.id)];
  const shown = searching || all ? makers : makers.slice(0, FEW);
  // The venue's own glasses as typed, or as the forgiving search found them ("nick and nora" for Nick & Nora).
  const matches = (m: GlassModel) => !searching || found.some((f) => f.id === m.id) || `${m.maker?.display_name ?? ''} ${m.name} ${m.series ?? ''}`.toLowerCase().includes(search.toLowerCase());

  const pickModel = (m: GlassModel) => {
    if (!('setGlassModel' in editor)) return;
    editor.setGlassModel(m);
    // Drawn as the glass is, until someone picks another drawing below.
    editor.setSketchVariant(null);
    onClose();
  };
  const pickShape = (id: string) => {
    // A shape is a choice of its own: it lets the real glass go, even when it's that glass's shape.
    if (model && 'setGlassModel' in editor) editor.setGlassModel(null);
    editor.setSpecId('glassware', editor.glasswareId === id && !model ? null : id);
    onClose();
  };
  const name = adding.trim();
  // Naming a glass that isn't one of the shapes asks what kind it is.
  const asking = !!name && !editor.glassware.some((g) => g.name?.trim().toLowerCase() === name.toLowerCase());
  const add = async () => {
    if (!name) return;
    editor.setSpecId('glassware', await editor.handleAddPill('glassware', name, asking ? pickedKind('glass', name, kind) : undefined));
    setAdding('');
    setKind(undefined);
  };

  return (
    <Sheet
      style={SHEET_PAD}
      visible
      onClose={onClose}
      accessibilityLabel="Glass"
      keyboard
      header={
        <View style={styles.head}>
          <Headline role="heading" style={styles.flex}>
            Glass
          </Headline>
          <Button label="Done" size="sm" variant="ghost" onPress={onClose} />
        </View>
      }
    >
      <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {canModel ? (
          <Field
            label="Find a glass"
            hideLabel
            icon="magnifyingglass"
            value={term}
            onChangeText={setTerm}
            placeholder="Find a glass: maker, name, shape"
            autoCorrect={false}
            maxLength={80}
          />
        ) : null}
        <View role="radiogroup" aria-label="Glass" style={styles.body}>
          {ours.filter(matches).length ? (
            <Section title={`${venue?.name ?? 'The venue'}’s glasses`}>
              {ours.filter(matches).map((m, i) => (
                <GlassModelRow key={m.id} model={m} first={i === 0} selected={model?.id === m.id} onPress={() => pickModel(m)} />
              ))}
            </Section>
          ) : null}
          {shown.length ? (
            <Section title="From makers">
              {shown.map((m, i) => (
                <GlassModelRow key={m.id} model={m} first={i === 0} selected={model?.id === m.id} onPress={() => pickModel(m)} />
              ))}
            </Section>
          ) : searching && !isFetching ? (
            <Caption tone="muted">No maker lists a glass like that yet.</Caption>
          ) : null}
          {!searching && !all && makers.length > FEW && glassType ? (
            <Button
              label={`Every ${GLASS_TYPE_LABEL[glassType].toLowerCase()} makers list`}
              variant="ghost"
              onPress={() => setAll(true)}
              style={styles.start}
            />
          ) : null}
          <View style={styles.section}>
            <Caption tone="muted" role="heading">
              Shapes
            </Caption>
            <View style={styles.chips}>
              {editor.glassware.map((g) => (
                <Chip key={g.id} label={g.name} selected={!model && editor.glasswareId === g.id} onPress={() => pickShape(g.id)} />
              ))}
            </View>
          </View>
        </View>
        <View style={styles.addRow}>
          <TextInput
            value={adding}
            onChangeText={setAdding}
            onSubmitEditing={() => void add()}
            placeholder="Add a glass"
            placeholderTextColor={ds.c.muted}
            accessibilityLabel="Add a glass"
            style={[styles.input, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.surface }]}
          />
          <Button label="Add" size="sm" variant="secondary" disabled={!name} onPress={() => void add()} />
        </View>
        {asking ? <KindQuestion of="glass" name={name} value={kind} onChange={setKind} /> : null}
        {/* A draft has no drawing yet, so its glass shape is picked once it's published. */}
        {itemId && 'sketchVariant' in editor ? (
          <SketchGlassPicker itemId={itemId} barId={editor.barId} glassware={shape} value={editor.sketchVariant} onChange={editor.setSketchVariant} />
        ) : null}
        {canModel ? <Caption tone="muted">A real glass brings its size, so the drink page can say how full it pours.</Caption> : null}
      </SheetScrollView>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.section}>
      <Caption tone="muted" role="heading">
        {title}
      </Caption>
      <View style={[styles.group, { backgroundColor: ds.c.surface }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  scroll: { flexShrink: 1 },
  body: { gap: space.lg },
  section: { gap: space.sm },
  group: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignSelf: 'flex-start' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { ...type.body, fontFamily: fontFamilies.body, flex: 1, minHeight: layout.minTapTarget, borderRadius: radius.control, paddingHorizontal: space.md },
});
