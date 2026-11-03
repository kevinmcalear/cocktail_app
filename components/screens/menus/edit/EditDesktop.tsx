import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { Caption, DsText, Field, GlassButton, Tag, useDs, type TagTone } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { displayFaces, font, layout, radius, space, type } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { itemHref } from '@/lib/itemRoutes';

import { MenuVisual } from '../MenuVisual';
import { Check, MonoLabel, ReadyChecks, type CheckTarget } from '../ReviewParts';
import { useMenuDrag } from '../useMenuDrag';
import { GuestPreview } from '../GuestPreview';
import { CoverButtons, EditAfter, EditGroup, EditSections } from './EditParts';
import { EditLibrary } from './EditLibrary';
import { EditMoreSheet } from './EditSheetsMore';
import { EditTools, SaveLine, saveProblem } from './EditTools';
import type { EditViewProps } from './MenuEditScreen';

const TONE: Record<'green' | 'amber' | 'quiet', TagTone> = { green: 'success', amber: 'warning', quiet: 'default' };
const ASIDE = 380;

/**
 * Desktop editing a menu (Miss-cover-credit-desk): a bar with Back, "Editing
 * Autumn", where saving stands, a ... (Save layout for next time,
 * Duplicate), the tools and Done; the library down the left; the menu (its
 * name typed in place, its dates in the card, sections in two columns when
 * there's room); and beside it what guests see and "Before it goes on":
 * what's left to do, the cover with Change and Remove, and Photo by. On the
 * web, library drinks and rows drag onto any section (useMenuDrag).
 */
export function EditDesktop(props: EditViewProps) {
  const { editor, look, onDates } = props;
  const ds = useDs();
  const [root, drag] = useMenuDrag(editor);
  const { layout: menu } = editor;
  const problem = saveProblem(editor);
  const [more, setMore] = useState(false);
  // Library, menu and aside: two columns of drinks only when the menu has room for them.
  const twoUp = useWindowDimensions().width >= 1600;
  return (
    <View ref={root} style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.top, { borderBottomColor: ds.c.lineStrong }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back to the menu" onPress={editor.leave} />
        <DsText variant="label" style={[font.semiBold, styles.flex]} numberOfLines={1}>
          {`Editing ${menu.name.trim() || 'a menu'}`}
        </DsText>
        {problem ? (
          <Caption tone="accent" role="alert" numberOfLines={2} style={styles.error}>
            {`Not saved: ${problem}`}
          </Caption>
        ) : (
          <SaveLine editor={editor} />
        )}
        <GlassButton icon="ellipsis" accessibilityLabel={`More for ${menu.name || 'this menu'}: save layout for next time, duplicate`} onPress={() => setMore(true)} />
        <EditTools {...props} addTo={editor.section(editor.targetKey)?.key} />
      </View>
      <View style={styles.columns}>
        <EditLibrary editor={editor} drag={drag} venueName={look.venueName} />
        <FormScrollContainer style={styles.flex} contentContainerStyle={styles.main}>
          <View style={styles.title}>
            <View style={styles.eyebrow}>
              {look.tag ? <Tag label={look.tag.label} tone={TONE[look.tag.tone]} /> : null}
              {look.eyebrow ? (
                <Caption tone="muted" style={styles.caps}>
                  {look.eyebrow.toUpperCase()}
                </Caption>
              ) : null}
            </View>
            <TextInput
              value={menu.name}
              onChangeText={editor.rename}
              aria-label="Menu name"
              placeholder="Name it"
              placeholderTextColor={ds.c.faint}
              maxLength={80}
              style={[type.display, styles.name, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink }]}
            />
            {editor.menu.description ? (
              <DsText variant="headline" italic tone="muted">
                {editor.menu.description}
              </DsText>
            ) : null}
            {look.home ? null : <EditGroup editor={editor} look={look} onDates={onDates ?? (() => {})} wide />}
          </View>
          <View style={styles.grid}>
            <EditSections editor={editor} ink={look.ink} drag={drag} width={twoUp ? '50%' : '100%'} />
          </View>
          <EditAfter editor={editor} />
        </FormScrollContainer>
        <Aside {...{ editor, look, onDates }} />
      </View>
      {more ? <EditMoreSheet editor={editor} onClose={() => setMore(false)} /> : null}
    </View>
  );
}

function Aside({ editor, look, onDates }: Pick<EditViewProps, 'editor' | 'look' | 'onDates'>) {
  const ds = useDs();
  const router = useRouter();
  const { venues } = useActiveVenue();
  const venue = venues.find((v) => v.id === editor.menu.barId) ?? null;
  const { coverUrl, coverPosition, coverCredit, name, sections } = editor.layout;
  const dated = !!(editor.menu.startsAt ?? editor.menu.plannedStartsAt);
  // A checklist row opens what it names: a short section's rules, the dates, or a drink.
  const open = (t: CheckTarget) => {
    // A menu that's on keeps its start: its end is what's left to set.
    if (t.kind === 'dates') return onDates ? onDates() : look.canEnd ? editor.setSheet({ kind: 'ends' }) : undefined;
    if (t.kind === 'section') {
      const s = sections.find((x) => x.name === t.name);
      if (s) editor.setSheet({ kind: 'section', key: s.key });
      return;
    }
    // A drink with no price or photo: its own page, where both are set.
    const d = sections.flatMap((x) => x.drinks).find((x) => x.name === t.name);
    if (d) router.push(itemHref(d.kind === 'beer' ? 'Beer' : d.kind === 'wine' ? 'Wine' : 'Cocktail', d.id) as never);
  };
  const credit = coverCredit?.trim();
  return (
    <ScrollView style={[styles.aside, { borderLeftColor: ds.c.lineStrong, backgroundColor: ds.c.surface }]} contentContainerStyle={styles.asideBody} aria-label={look.home ? 'Before you share' : 'Before it goes on'}>
      <GuestPreview editor={editor} venue={venue} />
      <MonoLabel>{look.home ? 'Before you share' : 'Before it goes on'}</MonoLabel>
      <View>
        <ReadyChecks sections={sections} home={look.home} dated={look.home ? undefined : dated} onOpen={open} />
        <Check done={!!coverUrl} label={coverUrl ? 'Cover photo' : 'Cover'} note={coverUrl ? (look.venueName ? `For ${look.venueName}` : 'Just yours') : 'Drawn from your drinks until you add a photo'} />
        <View style={[styles.cover, { backgroundColor: ds.c.raised }]}>
          <MenuVisual name={name || 'Menu'} coverUrl={coverUrl} coverPosition={coverPosition} pictures={sections.flatMap((s) => s.drinks)} height={96} />
          <View style={styles.coverButtons}>
            <CoverButtons editor={editor} onMedia={!!coverUrl || sections.some((s) => s.drinks.length)} />
          </View>
        </View>
        {coverUrl ? (
          <View style={styles.credit}>
            <Field
              label="Photo by"
              placeholder="Who took it?"
              value={coverCredit ?? ''}
              onChangeText={editor.setCoverCredit}
              maxLength={80}
              autoCapitalize="words"
              hint={`Shows on the cover as Photo: ${credit || 'their name'}. Leave it empty and there’s no line.`}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.xl, borderBottomWidth: StyleSheet.hairlineWidth },
  error: { maxWidth: 360 },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  main: { paddingTop: space.xxl, paddingLeft: space.xxxl, paddingRight: space.xxl, paddingBottom: space.xxxl },
  title: { gap: space.sm },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  caps: { letterSpacing: 1.2, ...font.medium },
  name: { paddingVertical: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xl },
  aside: { width: ASIDE, flexGrow: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  asideBody: { padding: space.xl, gap: space.lg },
  cover: { height: 96, marginLeft: layout.minTapTarget - space.md, borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous' },
  coverButtons: { position: 'absolute', left: space.sm, bottom: space.sm, right: space.sm, flexDirection: 'row', gap: space.sm },
  credit: { marginLeft: layout.minTapTarget - space.md, marginTop: space.md },
});
