import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMenu } from '@/hooks/useMenus';
import type { MenuDetail } from '@/types/menus';

import { AddDrinkSheet } from './AddDrinkSheet';
import { PasteMenuSheet } from './PasteMenuSheet';
import { EditorDesktop } from './EditorDesktop';
import { EditorActions, EditorSections, MenuCoverEdit, MenuNameInput } from './EditorParts';
import { GoLiveSheet } from './GoLiveSheet';
import { SectionSheet } from './SectionSheet';
import { useLayoutEditor, type LayoutEditor } from './useLayoutEditor';

/**
 * Editing a menu: its name, cover, sections and drinks. Changes stay on the
 * device until Save, which writes the whole layout in one go.
 */
export function MenuEditorScreen({ menuId }: { menuId: string }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const router = useRouter();
  const userId = useUserId();
  // Edits start from the server's copy, never a cached one: saving writes the
  // whole layout, so a stale start would undo someone else's changes.
  const { data: menu, isLoading, isFetchedAfterMount } = useMenu(menuId, { fresh: true });
  const caps = useCapabilities(menu?.barId);
  const canEdit = menu ? (menu.barId ? Array.isArray(caps.data) && caps.data.includes('menus') : menu.createdBy === userId) : false;
  const checking = isLoading || !isFetchedAfterMount || (!!menu?.barId && caps.isLoading);

  if (!menu || !canEdit || checking) {
    return (
      <View style={[styles.screen, styles.message, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.lg, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}`))} />
        <Body tone="muted">
          {checking ? 'Opening the menu…' : !menu ? 'This menu isn’t there any more.' : 'Only people who build menus at this venue can edit it.'}
        </Body>
      </View>
    );
  }
  return <EditorBody key={menu.id} menu={menu} />;
}

function EditorBody({ menu }: { menu: MenuDetail }) {
  const editor = useLayoutEditor(menu);
  const desktop = useBreakpoint() === 'desktop';
  return (
    <>
      {desktop ? <EditorDesktop editor={editor} /> : <EditorPhone editor={editor} />}
      <EditorSheets editor={editor} />
    </>
  );
}

function EditorPhone({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const [barHeight, setBarHeight] = useState(96);
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FormScrollContainer contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingHorizontal: gutter, paddingBottom: barHeight + space.xl, gap: space.md }}>
        <View style={styles.top}>
          <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={editor.leave} />
          <Caption tone="muted">{editor.changed ? 'Unsaved changes' : 'Saved'}</Caption>
          <View style={styles.spacer} />
        </View>
        <MenuCoverEdit editor={editor} height={112} />
        <MenuNameInput editor={editor} />
        {editor.error ? <Body tone="accent">{editor.error}</Body> : null}
        <EditorSections editor={editor} />
      </FormScrollContainer>
      <View
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
        style={[styles.bar, { paddingBottom: insets.bottom + space.md, paddingHorizontal: gutter, backgroundColor: ds.c.ground, borderTopColor: ds.c.line }]}
      >
        <EditorActions editor={editor} />
      </View>
    </View>
  );
}

function EditorSheets({ editor }: { editor: LayoutEditor }) {
  const { sheet } = editor;
  const section = sheet && sheet.kind !== 'golive' ? editor.section(sheet.key) : null;
  const index = section ? editor.layout.sections.indexOf(section) : -1;
  return (
    <>
      {sheet?.kind === 'paste' ? (
        <PasteMenuSheet
          into={section}
          library={editor.library}
          already={editor.layout.sections[editor.layout.sections.length - 1]?.drinks.map((drink) => drink.id)}
          onClose={() => editor.setSheet(null)}
          onApply={(groups) => editor.applyPaste(sheet.key, groups)}
        />
      ) : null}
      {sheet?.kind === 'add' ? (
        <AddDrinkSheet
          section={section}
          onClose={() => editor.setSheet(null)}
          library={editor.library}
          elsewhere={editor.elsewhere}
          onAdd={(d) => editor.add(sheet.key, d)}
        />
      ) : null}
      {sheet?.kind === 'section' && section ? (
        <SectionSheet
          section={section}
          isFirst={index === 0}
          isLast={index === editor.layout.sections.length - 1}
          onClose={() => editor.setSheet(null)}
          onSave={(rule) => editor.updateSection(section.key, rule)}
          onMove={(by) => editor.moveSection(section.key, by)}
          onRemove={() => editor.removeSection(section.key)}
        />
      ) : null}
      {sheet?.kind === 'golive' ? (
        <GoLiveSheet
          visible
          onClose={() => editor.setSheet(null)}
          menu={{ id: editor.menu.id, name: editor.layout.name, barId: editor.menu.barId, sections: editor.layout.sections.map((s) => ({ ...s, id: s.id ?? s.key })) }}
          others={editor.others}
          onDone={editor.done}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  message: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 44 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
