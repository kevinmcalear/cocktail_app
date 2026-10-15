import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Sheet, useDs } from '@/components/ds';
import { SketchGlassPicker } from '@/components/cocktail/SketchGlassPicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { SpecCategory, useCocktailEditor } from '@/hooks/useCocktailEditor';

type Editor = ReturnType<typeof useCocktailEditor>;
type Option = { id: string; name: string };

const SHEET_PAD = { paddingHorizontal: space.xl, paddingBottom: space.xxl };
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const ROWS: { category: SpecCategory; label: string; empty: string }[] = [
  { category: 'glassware', label: 'Glass', empty: 'Pick a glass' },
  { category: 'ice', label: 'Ice', empty: 'No ice set' },
  { category: 'method', label: 'Method', empty: 'Shake, stir, build…' },
  { category: 'family', label: 'Family', empty: 'Sour, highball…' },
];

const optionsOf = (editor: Editor, category: SpecCategory): Option[] =>
  ({ glassware: editor.glassware, ice: editor.iceTypes, method: editor.methods, family: editor.families })[category] as Option[];

const valueOf = (editor: Editor, category: SpecCategory, options: Option[]) => {
  const ids = category === 'method' ? editor.methodIds : [editor.getSpecId(category)].filter(Boolean);
  return ids.map((id) => options.find((o) => o.id === id)?.name).filter(Boolean).join(', ');
};

/**
 * How it's made, while editing (drink-edit-phone): glass, ice, method and
 * family as one grouped list, each value with a chevron that opens a small
 * sheet to pick it. Replaces the old strip of plus signs.
 */
export function MadeList({ editor, itemId }: { editor: Editor; itemId: string }) {
  const ds = useDs();
  const [open, setOpen] = useState<SpecCategory | null>(null);
  return (
    <View style={styles.section}>
      <Headline role="heading">How it’s made</Headline>
      <View style={[styles.group, { backgroundColor: ds.c.surface }]}>
        {ROWS.map((r, i) => {
          const value = valueOf(editor, r.category, optionsOf(editor, r.category));
          return (
            <PressableScale
              key={r.category}
              role="button"
              accessibilityLabel={`${r.label}: ${value || 'not set'}. Change it`}
              onPress={() => setOpen(r.category)}
              style={[styles.row, i < ROWS.length - 1 && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <Body tone="muted" style={styles.label}>
                {r.label}
              </Body>
              <Body numberOfLines={1} tone={value ? undefined : 'muted'} style={styles.value}>
                {value || r.empty}
              </Body>
              <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
            </PressableScale>
          );
        })}
      </View>
      {open ? <PickSheet editor={editor} itemId={itemId} category={open} label={ROWS.find((r) => r.category === open)?.label ?? ''} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

/** One of How it's made's sheets: tap to pick (methods take several), or add a new one by name. */
function PickSheet({ editor, itemId, category, label, onClose }: { editor: Editor; itemId: string; category: SpecCategory; label: string; onClose: () => void }) {
  const ds = useDs();
  const [adding, setAdding] = useState('');
  const options = optionsOf(editor, category);
  const multi = category === 'method';
  const picked = (id: string) => (multi ? editor.methodIds.includes(id) : editor.getSpecId(category) === id);
  const choose = (id: string) => {
    if (multi) return editor.toggleMethod(id);
    editor.setSpecId(category, picked(id) ? null : id);
    onClose();
  };
  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    const id = await editor.handleAddPill(category, name);
    if (multi) {
      if (!editor.methodIds.includes(id)) editor.toggleMethod(id);
    } else editor.setSpecId(category, id);
    setAdding('');
  };
  return (
    <Sheet style={SHEET_PAD}
      visible
      onClose={onClose}
      accessibilityLabel={label}
      keyboard
      header={
        <View style={styles.sheetHead}>
          <Headline role="heading" style={styles.flex}>
            {label}
          </Headline>
          <Button label="Done" size="sm" variant="ghost" onPress={onClose} />
        </View>
      }
    >
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        <View role={multi ? 'group' : 'radiogroup'} accessibilityLabel={label}>
          {options.map((o) => (
            <PressableScale
              key={o.id}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={picked(o.id)}
              accessibilityLabel={o.name}
              onPress={() => choose(o.id)}
              style={[styles.option, { borderBottomColor: ds.c.line }]}
            >
              <Body style={styles.flex}>{o.name}</Body>
              {picked(o.id) ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
            </PressableScale>
          ))}
        </View>
      </ScrollView>
      <View style={styles.addRow}>
        <TextInput
          value={adding}
          onChangeText={setAdding}
          onSubmitEditing={() => void add()}
          placeholder={`Add a ${label.toLowerCase()}`}
          placeholderTextColor={ds.c.muted}
          accessibilityLabel={`Add a ${label.toLowerCase()}`}
          style={[styles.input, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.surface }]}
        />
        <Button label="Add" size="sm" variant="secondary" disabled={!adding.trim()} onPress={() => void add()} />
      </View>
      {category === 'glassware' ? (
        <SketchGlassPicker
          itemId={itemId}
          barId={editor.barId}
          glasswareName={editor.glassware.find((g) => g.id === editor.glasswareId)?.name ?? null}
          value={editor.sketchVariant}
          onChange={editor.setSketchVariant}
        />
      ) : null}
      {multi ? <Caption tone="muted">A drink can have more than one: shaken then topped, built then swizzled.</Caption> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  group: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  label: { width: 72 },
  value: { flex: 1, textAlign: 'right' },
  flex: { flex: 1, minWidth: 0 },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  list: { maxHeight: 360 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget + space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md },
  input: { ...type.body, fontFamily: fontFamilies.body, flex: 1, minHeight: layout.minTapTarget, borderRadius: radius.control, paddingHorizontal: space.md },
});
