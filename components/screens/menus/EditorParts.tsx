import { StyleSheet, TextInput, View } from 'react-native';

import { Button, DrinkImage, GlassButton, useDs } from '@/components/ds';
import { displayFaces, radius, space, type } from '@/constants/tokens';
import { useMode } from '@/hooks/useMode';

import { EditorSection } from './EditorSection';
import type { LayoutEditor } from './useLayoutEditor';

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

export function MenuCoverEdit({ editor, height }: { editor: LayoutEditor; height: number }) {
  const ds = useDs();
  const { coverUrl } = editor.layout;
  return (
    <View style={[styles.cover, { height, backgroundColor: ds.c.surface }]}>
      {coverUrl ? <DrinkImage source={coverUrl} accessibilityLabel="Menu cover" radius={0} style={{ height, aspectRatio: undefined }} /> : null}
      <View style={styles.coverButtons}>
        <GlassButton label={editor.coverBusy ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add a cover'} accessibilityLabel={coverUrl ? 'Change cover' : 'Add a cover'} onPress={editor.pickCover} onMedia={!!coverUrl} />
        {coverUrl ? <GlassButton icon="xmark" accessibilityLabel="Remove cover" onPress={editor.removeCover} onMedia /> : null}
      </View>
    </View>
  );
}

/** A menu of your own, in home mode: no venue calendar, prices or menu photos. */
export function useHomeMenu(editor: LayoutEditor): boolean {
  return useMode().mode === 'home' && !editor.menu.barId;
}

/** Save and Go live, or just Save for a menu that's already on (or a home menu, which has its own night). */
export function EditorActions({ editor, size = 'lg' }: { editor: LayoutEditor; size?: 'md' | 'lg' }) {
  const home = useHomeMenu(editor);
  const on = editor.status === 'on' || home;
  const saveLabel = editor.saving ? 'Saving…' : editor.changed ? (on ? 'Save changes' : 'Save draft') : 'Saved';
  return (
    <View style={styles.actions}>
      <Button
        label={saveLabel}
        size={size}
        variant={on ? 'primary' : 'secondary'}
        onPress={editor.persist}
        disabled={editor.saving || !editor.changed}
        style={styles.flex}
      />
      {on ? null : (
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
          onPaste={() => editor.setSheet({ kind: 'paste', key: s.key })}
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
  flex: { flex: 1 },
});
