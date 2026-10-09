import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, GlassButton, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space, type } from '@/constants/tokens';
import { useMode } from '@/hooks/useMode';

import { EditorSection } from './EditorSection';
import { MenuVisual } from './MenuVisual';
import type { LayoutEditor } from './useLayoutEditor';

/** Where the menu stands, for the editor's header. */
export const EDITOR_STATUS = { on: 'On now', upcoming: 'Coming up', draft: 'Draft', previous: 'Previous' } as const;

/** The name, in the venue's display face, edited in place. */
export function MenuNameInput({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  return (
    <TextInput
      value={editor.layout.name}
      onChangeText={editor.rename}
      aria-label="Menu name"
      placeholder="Menu name"
      placeholderTextColor={ds.c.faint}
      style={[type.title, styles.name, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink, borderBottomColor: ds.c.lineStrong }]}
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

/** A menu of your own, in home mode: no venue calendar, prices or menu photos. */
export function useHomeMenu(editor: LayoutEditor): boolean {
  return useMode().mode === 'home' && !editor.menu.barId;
}

/**
 * Save and Go live, or just Save for a menu that's already on (or a home
 * menu, which has its own night). With nothing to save, Save gives way to a
 * quiet "Saved", so the accent only marks something to do.
 */
export function EditorActions({ editor, size = 'lg' }: { editor: LayoutEditor; size?: 'md' | 'lg' }) {
  const ds = useDs();
  const home = useHomeMenu(editor);
  const on = editor.status === 'on' || home;
  return (
    <View style={styles.actions}>
      {editor.changed || editor.saving ? (
        <Button
          label={editor.saving ? 'Saving…' : on ? 'Save changes' : 'Save draft'}
          size={size}
          variant={on ? 'primary' : 'secondary'}
          onPress={editor.persist}
          disabled={editor.saving}
          style={styles.flex}
        />
      ) : (
        <View style={[styles.flex, styles.saved]} aria-live="polite">
          <IconSymbol name="checkmark" size={14} color={ds.c.muted} />
          <Caption tone="muted">Saved</Caption>
        </View>
      )}
      {home ? (
        // Sharing is the home menu's next step: in the accent once there's nothing left to save.
        <Button label="Share…" icon="square.and.arrow.up" size={size} variant={editor.changed || editor.saving ? 'secondary' : 'primary'} onPress={editor.share} disabled={editor.saving} style={styles.flex} />
      ) : on ? null : (
        <Button label={editor.status === 'upcoming' ? 'Change date…' : 'Go live…'} size={size} onPress={editor.goLive} disabled={editor.saving} style={styles.flex} />
      )}
    </View>
  );
}

/** Every section, in order, then adding one. */
export function EditorSections({ editor, targetable }: { editor: LayoutEditor; targetable?: boolean }) {
  const home = useHomeMenu(editor);
  return (
    <View style={styles.sections}>
      {editor.layout.sections.map((s) => (
        <EditorSection
          key={s.key}
          section={s}
          targeted={targetable && editor.targetKey === s.key}
          onTarget={targetable ? () => editor.setTargetKey(s.key) : undefined}
          onAdd={() => editor.setSheet({ kind: 'add', key: s.key })}
          onSettings={() => editor.setSheet({ kind: 'section', key: s.key })}
          home={home}
          onRemove={(id) => editor.remove(s.key, id)}
          onReorder={(drinks) => editor.reorder(s.key, drinks)}
          onMove={(from, to) => editor.move(s.key, from, to)}
        />
      ))}
      <Button label="Add a section" icon="plus" variant="secondary" onPress={editor.addSection} style={styles.addSection} />
      <Button label="Paste a list" icon="doc.text" variant="secondary" onPress={() => editor.setSheet({ kind: 'paste', key: null })} style={styles.addSection} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous', justifyContent: 'flex-end' },
  coverButtons: { position: 'absolute', right: space.sm, bottom: space.sm, flexDirection: 'row', gap: space.sm },
  name: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.xs },
  sections: { gap: space.lg },
  addSection: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm },
  saved: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: 44 },
  flex: { flex: 1 },
});
