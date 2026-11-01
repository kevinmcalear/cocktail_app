import { Fragment, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Sheet, Switch, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { SpecCategory } from '@/hooks/useCocktailEditor';
import { COMMON_METHODS, iceLine } from '@/lib/drinkWizard';
import { showMessage } from '@/lib/dialogs';
import { findByName } from '@/lib/drinkMethods';
import { iceBuildLine, saysMore } from '@/lib/iceBuild';

import type { DrinkEditor as Editor } from './EditParts';
import { StepHead } from './EditParts';
import { GlassPickSheet } from './GlassPickSheet';
import { IceBuildSheet } from './IceBuildSheet';
type Option = { id: string; name: string; ice_kind?: string | null };

const SHEET_PAD = { paddingHorizontal: space.xl, paddingBottom: space.xxl };
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

type Category = SpecCategory | 'methodIce';
type IceEditor = Extract<Editor, { setIceBuild: unknown }>;
const iceEditor = (editor: Editor): IceEditor | null => ('setIceBuild' in editor ? editor : null);

// In adding a drink's order (method, glass, ice), so editing feels the same (Eddie, tf-070).
const ROWS: { category: Category; label: string; empty: string }[] = [
  { category: 'method', label: 'Method', empty: 'Shake, stir, build…' },
  // The ice it's made with (#697): this editor only.
  { category: 'methodIce', label: 'Ice (made with)', empty: 'Shaken with, stirred over…' },
  { category: 'glassware', label: 'Glass', empty: 'Pick a glass' },
  { category: 'ice', label: 'Ice (served on)', empty: 'No ice set' },
  { category: 'family', label: 'Family', empty: 'Sour, highball…' },
];

const optionsOf = (editor: Editor, category: Category): Option[] =>
  ({ glassware: editor.glassware, ice: editor.iceTypes, methodIce: editor.iceTypes, method: editor.methods, family: editor.families })[category] as Option[];

/** New's methods with no row yet (Churn, Eddie tf-061), made when picked. A one-word one is there already when a row starts like it ("Shaken" for Shake). */
const NEW = 'new:';
const unmadeMethods = (rows: Option[]): Option[] =>
  COMMON_METHODS.filter((m) => !findByName(rows, m) && (m.includes(' ') || !rows.some((r) => r.name.toLowerCase().startsWith(m.slice(0, 4).toLowerCase())))).map((m) => ({ id: NEW + m, name: m }));

const methodNames = (editor: Editor) => editor.methodIds.map((id) => (editor.methods as Option[]).find((m) => m.id === id)?.name).filter((n): n is string => !!n);

const valueOf = (editor: Editor, category: Category, options: Option[]) => {
  if (category === 'glassware' && 'glassModel' in editor && editor.glassModel) return editor.glassModel.name;
  const ice = iceEditor(editor);
  const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? '';
  if (category === 'methodIce') return ice?.methodIceId ? (iceLine(null, nameOf(ice.methodIceId), methodNames(editor)) ?? '') : '';
  if (category === 'ice' && ice && saysMore(ice.iceBuild)) return iceBuildLine(ice.iceBuild.map((l) => ({ ...l, ice: options.find((o) => o.id === l.ice) ?? '' })));
  const ids = category === 'method' ? editor.methodIds : [editor.getSpecId(category)].filter(Boolean);
  return ids.map((id) => options.find((o) => o.id === id)?.name).filter(Boolean).join(', ');
};

/**
 * How it's made, while editing (drink-edit-phone): glass, ice, method and
 * family as one grouped list, each value with a chevron that opens a small
 * sheet to pick it. Replaces the old strip of plus signs. A saved drink
 * has the Made in parts switch too; while it's on it takes the Method
 * row's place, and each part has its own method (drink-edit-parts).
 */
export function MadeList({ editor, itemId }: { editor: Editor; itemId: string | null }) {
  const ds = useDs();
  const [open, setOpen] = useState<Category | null>(null);
  const ice = iceEditor(editor);
  const parted = 'setMadeInParts' in editor ? editor : null;
  const rows = ROWS.filter((r) => (r.category !== 'methodIce' || ice) && (r.category !== 'method' || !parted?.parts));
  return (
    <View style={styles.section}>
      <StepHead step="method" eyebrow="Method, glass, ice" />
      <View style={[styles.group, { backgroundColor: ds.c.surface }]}>
        {rows.map((r, i) => {
          const value = valueOf(editor, r.category, optionsOf(editor, r.category));
          return (
            <Fragment key={r.category}>
              {r.category === 'family' && parted ? (
                <View style={[styles.row, { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <Body tone="muted" style={styles.flex}>
                    Made in parts
                  </Body>
                  <Switch value={!!parted.parts} onValueChange={parted.setMadeInParts} label="Made in parts" />
                </View>
              ) : null}
              <PressableScale
                role="button"
                accessibilityLabel={`${r.label}: ${value || 'not set'}. Change it`}
                onPress={() => setOpen(r.category)}
                style={[styles.row, i < rows.length - 1 && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <Body tone="muted" style={styles.label}>
                  {r.label}
                </Body>
                <Body numberOfLines={1} tone={value ? undefined : 'muted'} style={styles.value}>
                  {value || r.empty}
                </Body>
                <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
              </PressableScale>
            </Fragment>
          );
        })}
      </View>
      {open === 'glassware' ? (
        <GlassPickSheet editor={editor} itemId={itemId} onClose={() => setOpen(null)} />
      ) : open === 'ice' && ice ? (
        <IceBuildSheet
          options={ice.iceTypes as Option[]}
          layers={ice.iceBuild ?? (ice.iceId ? [{ ice: ice.iceId }] : [])}
          onChange={ice.setIceBuild}
          addIce={(name, kind) => ice.handleAddPill('ice', name, kind)}
          barId={ice.barId}
          madeWithId={ice.methodIceId}
          onClose={() => setOpen(null)}
        />
      ) : open ? (
        <PickSheet editor={editor} category={open} label={ROWS.find((r) => r.category === open)?.label ?? ''} onClose={() => setOpen(null)} />
      ) : null}
    </View>
  );
}

/**
 * Ice, method and family's sheets (the glass has its own): tap to pick
 * (methods take several), or add a new one by name. `part`: one part's
 * methods in a drink made in parts, with its own title (drink-edit-parts).
 */
export function PickSheet({ editor, category, label, onClose, part }: { editor: Editor; category: Category; label: string; onClose: () => void; part?: { title: string; ids: string[]; toggle: (id: string, name: string) => void } }) {
  const ds = useDs();
  const [adding, setAdding] = useState('');
  const multi = category === 'method';
  const rows = optionsOf(editor, category);
  const options = multi ? [...rows, ...unmadeMethods(rows)] : rows;
  const methodIds = part?.ids ?? editor.methodIds;
  const toggleMethod = part?.toggle ?? editor.toggleMethod;
  const ice = category === 'methodIce' ? iceEditor(editor) : null;
  const spec: SpecCategory = category === 'methodIce' ? 'ice' : category;
  const current = ice ? ice.methodIceId : editor.getSpecId(spec);
  const setOne = (id: string | null) => (ice ? ice.setMethodIceId(id) : editor.setSpecId(spec, id));
  const picked = (id: string) => (multi ? methodIds.includes(id) : current === id);
  // One new method row at a time: a second tap while Churn is being made doesn't make two.
  const making = useRef(false);
  const choose = async (id: string, name: string) => {
    if (multi && id.startsWith(NEW)) {
      if (making.current) return;
      making.current = true;
      try {
        toggleMethod(await editor.handleAddPill('method', name), name);
      } catch {
        showMessage('Couldn’t add that method', 'Check your connection and try again.');
      } finally {
        making.current = false;
      }
      return;
    }
    if (multi) return toggleMethod(id, name);
    setOne(picked(id) ? null : id);
    onClose();
  };
  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    const id = await editor.handleAddPill(spec, name);
    if (multi) {
      if (!methodIds.includes(id)) toggleMethod(id, name);
    } else setOne(id);
    setAdding('');
  };
  return (
    <Sheet style={SHEET_PAD}
      visible
      onClose={onClose}
      accessibilityLabel={part?.title ?? label}
      keyboard
      header={
        <View style={styles.sheetHead}>
          <Headline role="heading" style={styles.flex}>
            {part?.title ?? label}
          </Headline>
          <Button label="Done" size="sm" variant="ghost" onPress={onClose} />
        </View>
      }
    >
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        <View role={multi ? 'group' : 'radiogroup'} accessibilityLabel={part?.title ?? label}>
          {options.map((o) => (
            <PressableScale
              key={o.id}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={picked(o.id)}
              accessibilityLabel={o.name}
              onPress={() => void choose(o.id, o.name)}
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
          placeholder={`Add ${spec === 'ice' ? 'an ice' : `a ${label.toLowerCase()}`}`}
          placeholderTextColor={ds.c.muted}
          accessibilityLabel={`Add ${spec === 'ice' ? 'an ice' : `a ${label.toLowerCase()}`}`}
          style={[styles.input, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.surface }]}
        />
        <Button label="Add" size="sm" variant="secondary" disabled={!adding.trim()} onPress={() => void add()} />
      </View>
      {multi ? <Caption tone="muted">A drink can have more than one: shaken then topped, built then swizzled.</Caption> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  group: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  label: { minWidth: 72 },
  value: { flex: 1, textAlign: 'right' },
  flex: { flex: 1, minWidth: 0 },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  list: { maxHeight: 360 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget + space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md },
  input: { ...type.body, fontFamily: fontFamilies.body, flex: 1, minHeight: layout.minTapTarget, borderRadius: radius.control, paddingHorizontal: space.md },
});
