import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Body, Button, Caption, Field, GlassButton, Headline, useDs } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useSaveLayout } from '@/hooks/useMenuMutations';
import { cannotAdd, filterLibrary, libraryNote } from '@/lib/menuLayout';
import { menuDateLine, plural } from '@/lib/menus';

import { LibraryRow } from './AddDrinkSheet';
import { Eyebrow } from '../addDrink/WizardChrome';
import { EDITOR_STATUS, EditorActions, EditorSections, MenuCoverEdit, MenuNameInput, useHomeMenu } from './EditorParts';
import { GuestPreview } from './GuestPreview';
import { Check, ReadyChecks } from './ReviewParts';
import { Choice } from './MenuSheet';
import type { LayoutEditor } from './useLayoutEditor';


/** Desktop: the library to add from, the menu, and its settings side by side. */
export function EditorDesktop({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.header, { borderBottomColor: ds.c.line }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={editor.leave} />
        <View style={styles.flex}>
          <Caption tone="muted">{`Menus › ${EDITOR_STATUS[editor.status]}${editor.changed ? ' · unsaved changes' : ''}`}</Caption>
          <MenuNameInput editor={editor} />
          <Caption tone="muted">{[menuDateLine(editor.menu, now), plural(editor.layout.sections.reduce((n, s) => n + s.drinks.length, 0), 'drink')].filter(Boolean).join(' · ')}</Caption>
        </View>
        <Button label="Guest card" variant="secondary" onPress={() => router.push(`/menus/${editor.menu.id}/card`)} />
        <View style={styles.actions}>
          <EditorActions editor={editor} size="md" />
        </View>
      </View>
      <View style={styles.columns}>
        <LibraryPanel editor={editor} />
        <FormScrollContainer style={styles.flex} contentContainerStyle={styles.center}>
          {editor.error ? <Body tone="accent">{editor.error}</Body> : null}
          <EditorSections editor={editor} targetable />
        </FormScrollContainer>
        <Inspector editor={editor} />
      </View>
    </View>
  );
}

function LibraryPanel({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const target = editor.section(editor.targetKey) ?? editor.layout.sections[0] ?? null;
  const drinks = target ? filterLibrary(editor.library, target, query, freeOnly, editor.elsewhere) : [];
  return (
    <View style={[styles.side, { borderRightColor: ds.c.line }]}>
      <Headline>{target ? `Add to ${target.name}` : 'Add a section first'}</Headline>
      <Caption tone="muted">Click a section to add to it instead.</Caption>
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Search drinks" autoCapitalize="none" />
      <View role="radiogroup" accessibilityLabel="Show" style={styles.wrap}>
        <Choice label="All" selected={!freeOnly} onPress={() => setFreeOnly(false)} />
        <Choice label="Not on a menu" selected={freeOnly} onPress={() => setFreeOnly(true)} />
      </View>
      <ScrollView style={styles.flex}>
        {target && drinks.length === 0 ? <Body tone="muted">No drinks that fit {target.name}.</Body> : null}
        {target
          ? drinks.map((d) => (
              <LibraryRow
                key={d.id}
                drink={d}
                note={libraryNote(d, target, editor.elsewhere)}
                added={!!cannotAdd(target, d)}
                onAdd={() => editor.add(target.key, d)}
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

function Inspector({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const { venues } = useActiveVenue();
  const saveLayout = useSaveLayout();
  const [layoutSaved, setLayoutSaved] = useState(false);
  // A home menu has no photos to shoot, prices or venue layouts.
  const home = useHomeMenu(editor);
  const venue = venues.find((v) => v.id === editor.menu.barId);
  const keepLayout = async () => {
    try {
      await saveLayout.mutateAsync({ name: `${editor.layout.name.trim()} layout`, sections: editor.layout.sections });
      setLayoutSaved(true);
    } catch {
      setLayoutSaved(false);
    }
  };
  const { coverUrl } = editor.layout;
  // The preview card wants room, but the menu in the middle comes first: narrower under 1440.
  const width = useWindowDimensions().width >= 1440 ? 380 : 320;
  return (
    <ScrollView style={[styles.side, styles.inspector, { width, borderLeftColor: ds.c.line }]} contentContainerStyle={styles.inspectorBody}>
      <GuestPreview editor={editor} venue={venue ?? null} />
      <View style={styles.checks}>
        <Eyebrow>{home ? 'Before you share' : 'Before it goes on'}</Eyebrow>
        <ReadyChecks sections={editor.layout.sections} home={home} />
        <Check
          done={!!coverUrl}
          label={coverUrl ? 'Cover photo' : 'Cover'}
          note={coverUrl ? (venue ? `For ${venue.name}` : 'Just yours') : 'Drawn from your drinks until you add a photo'}
          action={<MenuCoverEdit editor={editor} height={96} />}
        />
      </View>
      {home ? null : (
        <>
          <View style={[styles.rule, { backgroundColor: ds.c.line }]} />
          <Headline>Layout</Headline>
          <Body tone="muted">{`${plural(editor.layout.sections.length, 'section')}. Changes here stay on this menu.`}</Body>
          <Button
            label={layoutSaved ? 'Layout saved' : saveLayout.isPending ? 'Saving…' : 'Save layout for next time'}
            variant="secondary"
            onPress={keepLayout}
            disabled={layoutSaved || saveLayout.isPending}
          />
          {saveLayout.error ? <Caption tone="accent">{saveLayout.error.message}</Caption> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg, paddingHorizontal: space.xxl, paddingTop: space.xl, paddingBottom: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { width: 300 },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  side: { width: 280, flexGrow: 0, padding: space.lg, gap: space.md, borderRightWidth: StyleSheet.hairlineWidth },
  inspector: { borderRightWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth, padding: 0 },
  inspectorBody: { padding: space.lg, gap: space.xl },
  checks: { gap: 0 },
  center: { padding: space.xl, gap: space.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  rule: { height: StyleSheet.hairlineWidth },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
