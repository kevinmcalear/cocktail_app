import { useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Sheet, Switch, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { addPart, linePart, MAX_PARTS, movePart, PART_JOINS, partMethodsSaid, removePart, type DraftPart } from '@/lib/drinkParts';
import { toLine } from '@/lib/recipeItem';

import { EditLines } from './EditLines';
import { MoreRow, type DrinkEditor } from './EditParts';
import { PickSheet } from './MadeList';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
type Field = ComponentRef<typeof TextInput>;
const SHEET_PAD = { paddingHorizontal: space.xl, paddingBottom: space.xxl };
/** A part's number, and how far its method and join sit in, under its name. */
const DISC = 24;
const INDENT = DISC + space.sm + 2;

type LinesProps = Omit<ComponentProps<typeof EditLines>, 'items' | 'onChange' | 'parts' | 'onParts' | 'partHead' | 'footer'>;

/**
 * A drink's spec while it's edited in place. Made in parts
 * (drink-edit-parts, approved 27 Oct 2026), its lines sit under numbered
 * part headings: the part's name to rename, its method as a button (the
 * method picker, for that part) and, after the first, Float on top or Pour
 * in. Each part has its own Add field, Add a part sits under the last, and
 * the … beside a part opens its options. A drink in one part, and a draft,
 * read as they always have.
 */
export function DrinkSpec({ editor, ...lines }: LinesProps & { editor: DrinkEditor }) {
  const ds = useDs();
  // The options sheet stays mounted while it slides away, so what was picked in it runs once it has gone (iOS: onDismiss).
  const [sheet, setSheet] = useState<{ at: number; kind: 'method' | 'options'; shown: boolean } | null>(null);
  const names = useRef<(Field | null)[]>([]);
  const ed = 'setParts' in editor ? editor : null;
  const parts = ed?.parts && ed.parts.length > 1 ? ed.parts : null;
  if (!ed || !parts) return <EditLines {...lines} items={editor.recipeItems} onChange={editor.setRecipeItems} />;

  const label = (at: number) => parts[at]?.name.trim() || `Part ${at + 1}`;
  const change = (at: number, patch: Partial<DraftPart>) => ed.setParts(parts.map((p, i) => (i === at ? { ...p, ...patch } : p)));
  const linesIn = (at: number) => editor.recipeItems.filter((item, i) => linePart(parts, toLine(item, i).key, false) === at + 1).map((l) => l.name);
  const open = sheet ? parts[sheet.at] : undefined;
  return (
    <>
      <EditLines
        {...lines}
        items={editor.recipeItems}
        onChange={editor.setRecipeItems}
        parts={parts}
        onParts={ed.setParts}
        partHead={(n) => (
          <PartHead
            n={n}
            part={parts[n - 1]}
            inputRef={(r) => void (names.current[n - 1] = r)}
            onChange={(patch) => change(n - 1, patch)}
            onMethod={() => setSheet({ at: n - 1, kind: 'method', shown: true })}
            onOptions={() => setSheet({ at: n - 1, kind: 'options', shown: true })}
          />
        )}
        footer={
          parts.length < MAX_PARTS ? (
            <PressableScale role="button" accessibilityLabel="Add a part" onPress={() => ed.setParts(addPart(parts))} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
              <IconSymbol name="plus" size={16} color={ds.accentText} />
              <Body>Add a part</Body>
            </PressableScale>
          ) : null
        }
      />
      {sheet?.kind === 'method' && open ? (
        <PickSheet
          editor={editor}
          category="method"
          label="Method"
          onClose={() => setSheet(null)}
          part={{
            title: `How ${label(sheet.at)} is made`,
            ids: open.methods.flatMap((m) => (m.id ? [m.id] : [])),
            toggle: (id, name) => change(sheet.at, { methods: open.methods.some((m) => m.id === id) ? open.methods.filter((m) => m.id !== id) : [...open.methods, { id, name }] }),
          }}
        />
      ) : null}
      {sheet?.kind === 'options' && open ? (
        <PartSheet
          visible={sheet.shown}
          n={sheet.at + 1}
          count={parts.length}
          label={label}
          lines={linesIn(sheet.at)}
          onClose={() => setSheet({ ...sheet, shown: false })}
          onRename={() => names.current[sheet.at]?.focus()}
          onMove={(by) => ed.setParts(movePart(parts, sheet.at, by))}
          onRemove={() => ed.setParts(removePart(parts, sheet.at))}
          onOff={() => ed.setMadeInParts(false)}
        />
      ) : null}
    </>
  );
}

/** A part's number, in the venue's colour (as the drink page's parts). */
function Disc({ n }: { n: number }) {
  const ds = useDs();
  return (
    <View style={[styles.disc, { backgroundColor: ds.accentFill.fill }]}>
      <DsText variant="caption" color={ds.accentFill.text}>
        {String(n)}
      </DsText>
    </View>
  );
}

/** A part's heading: its number, its name to rename, the … for its options, its method and, after the first, how it joins. */
function PartHead({ n, part, inputRef, onChange, onMethod, onOptions }: { n: number; part: DraftPart; inputRef: (r: Field | null) => void; onChange: (patch: Partial<DraftPart>) => void; onMethod: () => void; onOptions: () => void }) {
  const ds = useDs();
  const said = partMethodsSaid(part.methods.map((m) => m.name));
  return (
    <View style={styles.part}>
      <View style={styles.title}>
        <Disc n={n} />
        <TextInput
          ref={inputRef}
          value={part.name}
          onChangeText={(name) => onChange({ name })}
          placeholder={`Name of part ${n}`}
          placeholderTextColor={ds.c.muted}
          accessibilityLabel={`Name of part ${n}`}
          maxLength={60}
          autoCapitalize="sentences"
          style={[styles.name, NO_OUTLINE, { color: ds.c.ink, borderBottomColor: ds.c.lineStrong }]}
        />
        <PressableScale role="button" accessibilityLabel={`Part ${n} options`} onPress={onOptions} style={styles.more}>
          <IconSymbol name="ellipsis" size={20} color={ds.c.muted} />
        </PressableScale>
      </View>
      <PressableScale role="button" accessibilityLabel={`How part ${n} is made: ${said || 'not set'}. Change it`} onPress={onMethod} style={[styles.method, { borderColor: ds.c.lineStrong }]}>
        <DsText variant="label" tone={said ? 'ink' : 'muted'}>
          {said || 'How it’s made'}
        </DsText>
        <IconSymbol name="chevron.down" size={14} color={ds.c.muted} />
      </PressableScale>
      {n > 1 ? (
        <View style={styles.then}>
          <Caption tone="muted">Then</Caption>
          <View role="radiogroup" accessibilityLabel={`How part ${n} joins`} style={styles.joins}>
            {PART_JOINS.map((j) => {
              const on = part.join === j.value;
              return (
                <PressableScale
                  key={j.value}
                  role="radio"
                  aria-checked={on}
                  accessibilityLabel={j.label}
                  onPress={() => onChange({ join: j.value })}
                  style={[styles.join, { borderColor: on ? ds.accentFill.fill : ds.c.lineStrong, backgroundColor: on ? withAlpha(ds.accentFill.fill, 0.16) : 'transparent' }]}
                >
                  <DsText variant="label">{j.label}</DsText>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A part's options: Rename, Move up (or down), Remove this part (its lines
 * go to the part before, and Undo is in the toolbar), and the Made in parts
 * switch. Each runs once the sheet has gone, so it never changes under it.
 */
function PartSheet({ visible, n, count, label, lines, onClose, onRename, onMove, onRemove, onOff }: { visible: boolean; n: number; count: number; label: (at: number) => string; lines: string[]; onClose: () => void; onRename: () => void; onMove: (by: -1 | 1) => void; onRemove: () => void; onOff: () => void }) {
  const then = useRef<(() => void) | null>(null);
  const run = () => {
    const next = then.current;
    then.current = null;
    next?.();
  };
  const one = lines.length === 1;
  const moves = lines.length ? `${one ? 'Its line' : 'Its lines'}, ${lines.join(', ')}, ${one ? 'moves' : 'move'} to ${label(n > 1 ? n - 2 : 1)}. ` : '';
  return (
    <Sheet
      style={SHEET_PAD}
      visible={visible}
      onClose={() => {
        onClose();
        if (Platform.OS !== 'ios') run();
      }}
      onDismiss={run}
      accessibilityLabel={`${label(n - 1)}, options`}
      header={
        <View style={styles.sheetHead}>
          <Disc n={n} />
          <DsText variant="title" role="heading" numberOfLines={1} style={styles.flex}>
            {label(n - 1)}
          </DsText>
        </View>
      }
    >
      <MoreRow icon="pencil" label="Rename" onPick={() => (then.current = onRename)} />
      {n > 1 ? <MoreRow icon="arrow.up" label="Move up" onPick={() => (then.current = () => onMove(-1))} /> : null}
      {n < count ? <MoreRow icon="arrow.down" label="Move down" onPick={() => (then.current = () => onMove(1))} /> : null}
      <MoreRow icon="trash" label="Remove this part" danger note={`${moves}Undo is in the toolbar.`} onPick={() => (then.current = onRemove)} />
      <PartsOff onOff={() => (then.current = onOff)} />
    </Sheet>
  );
}

/** The Made in parts switch, on: turned off, it joins every line into one list and the methods in order. */
function PartsOff({ onOff }: { onOff: () => void }) {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <View style={[styles.switch, { backgroundColor: ds.c.raised }]}>
      <View style={styles.flex}>
        <Body>Made in parts</Body>
        <Caption tone="muted">Off joins every line into one list, methods in order</Caption>
      </View>
      <Switch
        value
        onValueChange={(on) => {
          if (on) return;
          onOff();
          close();
        }}
        label="Made in parts"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  part: { gap: space.xs },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingTop: space.sm },
  disc: { width: DISC, height: DISC, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.body, fontFamily: fontFamilies.bodySemiBold, flex: 1, minWidth: 0, paddingVertical: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  more: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  method: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: 40, marginLeft: INDENT, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  then: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: INDENT, marginTop: space.xs },
  joins: { flexDirection: 'row', gap: space.xs + 2 },
  join: { minHeight: 36, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, marginTop: space.sm, paddingHorizontal: space.lg, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  switch: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, marginTop: space.sm, paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.control },
  flex: { flex: 1, minWidth: 0 },
});
