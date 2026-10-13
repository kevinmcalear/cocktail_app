import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { Body, Button, Caption, GlassButton, useDs } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, type } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateMenu, useSaveLayout } from '@/hooks/useMenuMutations';
import { itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { cannotAdd, copySections, filterLibrary, libraryNote } from '@/lib/menuLayout';

import { LibraryRow } from './AddDrinkSheet';
import { EDITOR_STATUS, EditorSections, MenuCoverEdit, MenuNameInput, NextStep, SaveLine, useHomeMenu } from './EditorParts';
import { GuestPreview } from './GuestPreview';
import { Check, MonoLabel, ReadyChecks, type CheckTarget } from './ReviewParts';
import { Choice, MenuSheet } from './MenuSheet';
import type { LayoutEditor } from './useLayoutEditor';

const CATEGORY: Record<string, ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/**
 * Desktop: the library to add from, the menu, and what guests see side by
 * side, the whole width (no app sidebar). The header says "Menus · Draft ·
 * Little Rye" over the name, then a quiet save line, a ... for the layout and
 * a copy, the guest card, and Go live, the one accent.
 */
export function EditorDesktop({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const router = useRouter();
  const { venues } = useActiveVenue();
  const venue = venues.find((v) => v.id === editor.menu.barId);
  const [more, setMore] = useState(false);
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.header, { borderBottomColor: ds.c.line }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back to Menus" onPress={editor.leave} />
        <View style={styles.flex}>
          <MonoLabel>{['Menus', EDITOR_STATUS[editor.status], venue?.name].filter(Boolean).join(' · ')}</MonoLabel>
          <MenuNameInput editor={editor} />
        </View>
        <SaveLine editor={editor} />
        <GlassButton icon="ellipsis" accessibilityLabel={`More for ${editor.layout.name}: save layout for next time, duplicate`} onPress={() => setMore(true)} />
        <Button label="Guest card" variant="secondary" onPress={() => router.push(`/menus/${editor.menu.id}/card`)} />
        <View style={styles.next}>
          <NextStep editor={editor} size="md" label="Go live" />
        </View>
      </View>
      <View style={styles.columns}>
        <LibraryPanel editor={editor} />
        <FormScrollContainer style={styles.flex} contentContainerStyle={styles.center}>
          {editor.error ? <Body tone="accent">{editor.error}</Body> : null}
          <EditorSections editor={editor} targetable />
        </FormScrollContainer>
        <Inspector editor={editor} venueName={venue?.name ?? null} />
      </View>
      {more ? <MoreSheet editor={editor} onClose={() => setMore(false)} /> : null}
    </View>
  );
}

function LibraryPanel({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const { venues } = useActiveVenue();
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const target = editor.section(editor.targetKey) ?? editor.layout.sections[0] ?? null;
  const drinks = target ? filterLibrary(editor.library, target, query, freeOnly, editor.elsewhere) : [];
  const where = venues.find((v) => v.id === editor.menu.barId)?.name ?? 'your drinks';
  return (
    <View style={[styles.side, { borderRightColor: ds.c.line }]}>
      <MonoLabel>{target ? `Add to ${target.name}` : 'Add a section first'}</MonoLabel>
      <View style={[styles.search, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <IconSymbol name="magnifyingglass" size={16} color={ds.c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          aria-label={`Search ${where}`}
          placeholder={`Search ${where}`}
          placeholderTextColor={ds.c.faint}
          autoCapitalize="none"
          style={[type.body, styles.searchInput, { color: ds.c.ink }]}
        />
      </View>
      <View role="radiogroup" accessibilityLabel="Show" style={styles.wrap}>
        <Choice label="All" pill="accent" selected={!freeOnly} onPress={() => setFreeOnly(false)} />
        <Choice label="Not on a menu" pill="accent" selected={freeOnly} onPress={() => setFreeOnly(true)} />
      </View>
      <ScrollView style={styles.flex}>
        {target && drinks.length === 0 ? <Body tone="muted">No drinks that fit {target.name}.</Body> : null}
        {target
          ? drinks.map((d) => (
              <LibraryRow key={d.id} drink={d} note={libraryNote(d, target, editor.elsewhere)} added={!!cannotAdd(target, d)} onAdd={() => editor.add(target.key, d)} />
            ))
          : null}
      </ScrollView>
      {/* ponytail: tap + only. Dragging from here into a section needs drag across lists (board venue-menus-builder-desktop). */}
      <Caption tone="muted">Tap + to add to the section marked Adding here, or click another section.</Caption>
    </View>
  );
}

function Inspector({ editor, venueName }: { editor: LayoutEditor; venueName: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const { venues } = useActiveVenue();
  // A home menu has no photos to shoot, prices or venue dates.
  const home = useHomeMenu(editor);
  const venue = venues.find((v) => v.id === editor.menu.barId) ?? null;
  const { coverUrl } = editor.layout;
  const dated = !!(editor.menu.startsAt ?? editor.menu.plannedStartsAt);
  // A checklist row opens what it names: the short section, the dates, a drink that needs a photo or a price.
  const open = (target: CheckTarget) => {
    if (target.kind === 'dates') return void editor.goLive();
    if (target.kind === 'section') {
      const s = editor.layout.sections.find((x) => x.name === target.name);
      if (s) editor.setTargetKey(s.key);
      return;
    }
    const drink = editor.layout.sections.flatMap((s) => s.drinks).find((d) => d.name === target.name);
    if (drink) router.push(itemHref(CATEGORY[drink.kind] ?? 'Cocktail', drink.id) as never);
  };
  // The preview card wants room, but the menu in the middle comes first: narrower under 1440.
  const width = useWindowDimensions().width >= 1440 ? 380 : 320;
  return (
    <ScrollView style={[styles.side, styles.inspector, { width, borderLeftColor: ds.c.line }]} contentContainerStyle={styles.inspectorBody}>
      <GuestPreview editor={editor} venue={venue} />
      <View>
        <MonoLabel>{home ? 'Before you share' : 'Before it goes on'}</MonoLabel>
        <ReadyChecks sections={editor.layout.sections} home={home} dated={home ? undefined : dated} onOpen={open} />
        {/* Kept (g743): the cover lives here on desktop. */}
        <Check
          done={!!coverUrl}
          label={coverUrl ? 'Cover photo' : 'Cover'}
          note={coverUrl ? (venueName ? `For ${venueName}` : 'Just yours') : 'Drawn from your drinks until you add a photo'}
          action={<MenuCoverEdit editor={editor} height={96} />}
        />
      </View>
    </ScrollView>
  );
}

/** The header's ...: keep this layout for next time, or copy the menu as a new draft. */
function MoreSheet({ editor, onClose }: { editor: LayoutEditor; onClose: () => void }) {
  const router = useRouter();
  const saveLayout = useSaveLayout();
  const create = useCreateMenu();
  const home = useHomeMenu(editor);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepLayout = async () => {
    setError(null);
    try {
      await saveLayout.mutateAsync({ name: `${editor.layout.name.trim()} layout`, sections: editor.layout.sections });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save the layout.');
    }
  };
  const duplicate = async () => {
    setError(null);
    try {
      const { layout } = editor;
      const id = await create.mutateAsync({ barId: editor.menu.barId, layout: { ...layout, name: `${layout.name} copy`, sections: copySections(layout.sections, true) } });
      onClose();
      router.replace(`/menus/${id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t copy the menu.');
    }
  };
  return (
    <MenuSheet visible onClose={onClose} title={editor.layout.name || 'Menu'}>
      {home ? null : (
        <Button
          label={done ? 'Layout saved' : saveLayout.isPending ? 'Saving…' : 'Save layout for next time'}
          icon="square.on.square"
          variant="secondary"
          onPress={keepLayout}
          disabled={done || saveLayout.isPending}
        />
      )}
      <Button label={create.isPending ? 'Copying…' : 'Duplicate'} icon="doc.on.doc" variant="secondary" onPress={duplicate} disabled={create.isPending} />
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.xxl, paddingTop: space.xl, paddingBottom: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  // A row, so the button's flex: 1 widens it instead of squashing its height.
  next: { minWidth: 160, flexDirection: 'row' },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  side: { width: 320, flexGrow: 0, padding: space.lg, gap: space.md, borderRightWidth: StyleSheet.hairlineWidth },
  inspector: { borderRightWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth, padding: 0 },
  inspectorBody: { padding: space.lg, gap: space.xl },
  center: { padding: space.xl, gap: space.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 44 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
