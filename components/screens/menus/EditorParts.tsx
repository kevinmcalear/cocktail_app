import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space, type } from '@/constants/tokens';

import { EditorSection } from './EditorSection';
import { MenuVisual } from './MenuVisual';
import type { LayoutEditor } from './useLayoutEditor';
import type { MenuDrag } from './useMenuDrag';

/** Where the menu stands, for the editor's header. */
export const EDITOR_STATUS = { on: 'On now', upcoming: 'Coming up', draft: 'Draft', previous: 'Previous' } as const;

/** The name, in the venue's display face, edited in place: a plain title, no field line. */
export function MenuNameInput({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  return (
    <TextInput
      value={editor.layout.name}
      onChangeText={editor.rename}
      aria-label="Menu name"
      placeholder="Menu name"
      placeholderTextColor={ds.c.faint}
      style={[type.title, styles.name, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink }]}
    />
  );
}

/** The cover, or with none, the menu's first drinks (what guests see in its place). */
export function MenuCoverEdit({ editor, height }: { editor: LayoutEditor; height: number }) {
  const ds = useDs();
  const { coverUrl, name, sections } = editor.layout;
  const pictures = sections.flatMap((s) => s.drinks);
  const onMedia = !!coverUrl || pictures.length > 0;
  return (
    <View style={[styles.cover, { height, backgroundColor: ds.c.surface }]}>
      <MenuVisual name={name || 'Menu'} coverUrl={coverUrl} coverPosition={editor.layout.coverPosition} pictures={pictures} height={height} />
      <View style={styles.coverButtons}>
        <GlassButton label={editor.coverBusy ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add a cover'} accessibilityLabel={coverUrl ? 'Change cover' : 'Add a cover'} onPress={editor.pickCover} onMedia={onMedia} />
        {coverUrl ? <GlassButton icon="xmark" accessibilityLabel="Remove cover" onPress={editor.removeCover} onMedia /> : null}
      </View>
    </View>
  );
}

/** A menu of your own: no venue calendar, prices or menu photos, even opened while at a venue. */
export function useHomeMenu(editor: LayoutEditor): boolean {
  return !editor.menu.barId;
}

/** The save status line (b27: no save button): "Saving…", "Saved", "Not saved" when it couldn't. */
export function saveStatus(editor: LayoutEditor): { text: string; ok: boolean } {
  if (editor.saving || (editor.changed && !editor.error)) return { text: 'Saving…', ok: true };
  if (editor.changed) return { text: 'Not saved', ok: false };
  return { text: editor.savedAt ? 'Saved just now' : 'Saved', ok: true };
}

/** The quiet line with a check: where saving stands. */
export function SaveLine({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const { text, ok } = saveStatus(editor);
  return (
    <View style={styles.saved} aria-live="polite">
      {ok && text !== 'Saving…' ? <IconSymbol name="checkmark" size={14} color={ds.c.muted} /> : null}
      <Caption tone={ok ? 'muted' : 'accent'}>{text}</Caption>
    </View>
  );
}

/**
 * The editor's next step, the one accent: Next: go live for a venue's draft,
 * Change date for one coming up, Share for a home menu; nothing for a menu
 * that's on. On a phone it sits beside Add a section.
 */
export function NextStep({ editor, size = 'lg', label }: { editor: LayoutEditor; size?: 'md' | 'lg'; label?: string }) {
  const home = useHomeMenu(editor);
  if (home) return <Button label="Share…" icon="square.and.arrow.up" size={size} onPress={editor.share} disabled={editor.saving} style={styles.flex} />;
  if (editor.status === 'on' || editor.status === 'previous') return null;
  return <Button label={editor.status === 'upcoming' ? 'Change date…' : (label ?? 'Next: go live')} size={size} onPress={editor.goLive} disabled={editor.saving} style={styles.flex} />;
}

/** A phone's bottom bar: Add a section, then the next step. */
export function EditorActions({ editor }: { editor: LayoutEditor }) {
  return (
    <View style={styles.actions}>
      <Button label="Add a section" icon="plus" variant="secondary" onPress={editor.addSection} style={styles.flex} />
      <NextStep editor={editor} />
    </View>
  );
}

/** The section a phone's one Add a drink adds to: the first one short of its rule, else the last. */
function addTarget(editor: LayoutEditor): string | null {
  const { sections } = editor.layout;
  return (sections.find((s) => s.drinks.length < s.minItems) ?? sections[sections.length - 1])?.key ?? null;
}

/**
 * Every section, in order. Desktop adds into the section marked Adding here and
 * ends with Add a section; a phone has one dashed Add a drink after them all
 * (Add a section is in its bottom bar). Paste a list is in each section's ... menu.
 */
export function EditorSections({ editor, targetable, drag }: { editor: LayoutEditor; targetable?: boolean; drag?: MenuDrag }) {
  const ds = useDs();
  const home = useHomeMenu(editor);
  const target = addTarget(editor);
  return (
    <View style={styles.sections}>
      {editor.layout.sections.map((s) => (
        <EditorSection
          key={s.key}
          section={s}
          sections={editor.layout.sections}
          targeted={targetable && editor.targetKey === s.key}
          onTarget={targetable ? () => editor.setTargetKey(s.key) : undefined}
          onAdd={targetable && editor.targetKey === s.key ? () => editor.setSheet({ kind: 'add', key: s.key }) : undefined}
          onSettings={() => editor.setSheet({ kind: 'section', key: s.key })}
          home={home}
          made={editor.made}
          onRemove={(id) => editor.remove(s.key, id)}
          onReorder={(drinks) => editor.reorder(s.key, drinks)}
          onMove={(from, to) => editor.move(s.key, from, to)}
          onMoveTo={(id, toKey) => editor.moveTo(s.key, id, toKey)}
          pricing={home ? undefined : { menuName: editor.layout.name.trim() || editor.menu.name, barId: editor.menu.barId, onPrice: editor.setPrice, onMenuPrice: editor.setMenuPrice }}
          elsewhere={editor.elsewhere}
          drag={drag?.on ? { at: drag.at?.key === s.key ? drag.at.index : null, dragging: drag.dragging } : undefined}
        />
      ))}
      {targetable ? (
        <Button label="Add a section" icon="plus" variant="secondary" onPress={editor.addSection} style={styles.addSection} />
      ) : target ? (
        <PressableScale accessibilityLabel="Add a drink" onPress={() => editor.setSheet({ kind: 'add', key: target })} style={[styles.addDrink, { borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="plus" size={16} color={ds.c.ink} />
          <DsText variant="caption">Add a drink</DsText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous', justifyContent: 'flex-end' },
  coverButtons: { position: 'absolute', right: space.sm, bottom: space.sm, flexDirection: 'row', gap: space.sm },
  name: { paddingVertical: space.xs },
  sections: { gap: space.lg },
  addSection: { alignSelf: 'flex-start' },
  addDrink: { minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  saved: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  flex: { flex: 1 },
});
