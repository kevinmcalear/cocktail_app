import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { Body, Caption, useDs } from '@/components/ds';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, type } from '@/constants/tokens';
import { cannotAdd, filterLibrary, groupLibrary, libraryNote, nameToMake, nearLibrary } from '@/lib/menuLayout';

import { LibraryGroupHead, LibraryRow } from '../AddDrinkSheet';
import { MakeFromSearch, useMakeDrink } from '../MakeFromSearch';
import { Choice } from '../MenuSheet';
import { MonoLabel } from '../ReviewParts';
import type { LayoutEditor } from '../useLayoutEditor';
import { dragSource, type MenuDrag } from '../useMenuDrag';

/**
 * Desktop's library, down the left of the editor: search the venue's drinks
 * (or type a new name to make it), pick the section they go into, and click +
 * or drag a drink onto any section (useMenuDrag). Each add says so, with Undo.
 */
export function EditLibrary({ editor, drag, venueName }: { editor: LayoutEditor; drag: MenuDrag; venueName: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const { sections } = editor.layout;
  const target = editor.section(editor.targetKey) ?? sections[0] ?? null;
  // The filter only means something when another menu has drinks on it (Q13, 26 Oct 2026).
  const shared = Object.keys(editor.elsewhere).length > 0;
  const found = target ? filterLibrary(editor.library, target, query, freeOnly && shared, editor.elsewhere) : [];
  const where = venueName ?? 'your drinks';
  // Not there? The same search makes it, and close names follow (dm-decided).
  const missing = target ? nameToMake(editor.library, query) : null;
  const drinks = found.length || !target ? found : nearLibrary(editor.library, target, query);
  const make = useMakeDrink(target, editor.menu.barId);
  return (
    <View style={[styles.side, { borderRightColor: ds.c.lineStrong }]}>
      <MonoLabel>{target ? 'Add from the library' : 'Add a section first'}</MonoLabel>
      {sections.length > 1 ? (
        <View role="radiogroup" accessibilityLabel="Add to" style={styles.wrap}>
          {sections.map((s) => (
            <Choice key={s.key} label={s.name || 'Untitled'} pill="accent" selected={target?.key === s.key} onPress={() => editor.setTargetKey(s.key)} />
          ))}
        </View>
      ) : null}
      <View style={[styles.search, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="magnifyingglass" size={16} color={ds.c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          aria-label={`Search ${where}`}
          placeholder={`Search ${where}, or type a new name`}
          placeholderTextColor={ds.c.faint}
          onSubmitEditing={() => (missing ? make(missing) : undefined)}
          autoCapitalize="none"
          style={[type.body, styles.input, { color: ds.c.ink }]}
        />
      </View>
      {shared ? (
        <View role="radiogroup" accessibilityLabel="Show" style={styles.wrap}>
          <Choice label="All" pill="accent" selected={!freeOnly} onPress={() => setFreeOnly(false)} />
          <Choice label="Not on another menu" pill="accent" selected={freeOnly} onPress={() => setFreeOnly(true)} />
        </View>
      ) : null}
      {/* Only the rows in view are drawn: a library can be hundreds of drawn drinks. */}
      <SectionList
        style={styles.flex}
        sections={groupLibrary(drinks, editor.canMake, query)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: g }) => <LibraryGroupHead title={g.title} />}
        keyExtractor={(d) => d.id}
        extraData={target}
        initialNumToRender={12}
        windowSize={DRAWN_LIST_WINDOW}
        ListHeaderComponent={
          missing && target ? (
            <>
              <MakeFromSearch name={missing} section={target} where={venueName} onMake={() => make(missing)} onBringIn={() => router.push('/bring-in' as Href)} />
              {drinks.length ? <Caption tone="muted">{venueName ? `Close, at ${venueName}` : 'Close'}</Caption> : null}
            </>
          ) : undefined
        }
        ListEmptyComponent={target && !missing ? <Body tone="muted">No drinks that fit {target.name}.</Body> : undefined}
        renderItem={({ item: d }) =>
          target ? (
            <View {...(drag.on ? dragSource(d.id) : {})} style={drag.on && grab}>
              <LibraryRow drink={d} note={libraryNote(d, target, editor.elsewhere)} added={!!cannotAdd(target, d)} onAdd={() => editor.addWithUndo(target.key, d)} />
            </View>
          ) : null
        }
      />
      <Caption tone="muted">{drag.on ? 'Click + or drag a drink onto any section.' : `Tap + to add to ${target?.name ?? 'the section'}.`} Not here? Type its name to make it.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { width: 320, flexGrow: 0, padding: space.lg, gap: space.md, borderRightWidth: StyleSheet.hairlineWidth },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 44 },
  input: { flex: 1, minWidth: 0, paddingVertical: space.sm },
  flex: { flex: 1 },
});

// ponytail: web only. React Native's cursor type stops at pointer. Kept out of StyleSheet.create, whose
// narrower type rejects the cast once expo-env.d.ts (expo/types) is present.
const grab = { cursor: 'grab' } as unknown as ViewStyle;
