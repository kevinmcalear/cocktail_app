import { useRouter, type Href } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, GlassButton, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, type } from '@/constants/tokens';
import type { MenuStatus } from '@/types/menus';

import type { MenuInk } from '../page/MenuDrawing';
import { MenuPageGroup } from '../page/MenuPageGroup';
import type { LayoutEditor } from '../useLayoutEditor';
import type { MenuDrag } from '../useMenuDrag';
import { EditSection } from './EditSection';
import { lastDay } from './EditSheetsMore';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const TAGS: Record<MenuStatus, { label: string; tone: 'green' | 'amber' | 'quiet' }> = {
  on: { label: 'On now', tone: 'green' },
  upcoming: { label: 'Coming up', tone: 'quiet' },
  draft: { label: 'Draft', tone: 'amber' },
  previous: { label: 'Past menu', tone: 'quiet' },
};

/** How the menu being edited reads, as its page does: pencil while a venue's draft, its tag and eyebrow, and its dates. */
export function editLook(editor: LayoutEditor, venueName: string | null) {
  const { menu, status } = editor;
  const home = !menu.barId;
  const ink: MenuInk = status === 'draft' && !home ? 'pencil' : status === 'previous' ? 'faded' : 'colour';
  const start = menu.startsAt ?? menu.plannedStartsAt;
  const end = menu.endsAt ?? menu.plannedEndsAt;
  const since = status === 'on' && menu.startsAt ? `since ${day(menu.startsAt)}` : null;
  // Dates open the go-live step while it can still move: a draft's, or one coming up.
  const canDate = !home && (status === 'draft' || status === 'upcoming');
  return {
    home,
    venueName,
    ink,
    tag: home ? null : TAGS[status],
    eyebrow: [venueName ?? (home ? 'Your menu' : null), since].filter(Boolean).join(' · '),
    goesOn: since ?? (start ? day(start) : 'Pick a date'),
    // The board's "Add a date": Ends opens its sheet on any venue menu still to run or running.
    ends: end ? day(lastDay(end).toISOString()) : 'Add a date',
    canDate,
    canEnd: !home && status !== 'previous',
  };
}

/**
 * The card under the name while editing (Menu-who-creator-edit): Name, typed
 * in place; Goes on (the go-live step) and Ends (its own sheet); and with a cover photo,
 * Photo by (Miss-cover-credit), typed in place and shown under the cover.
 */
export function EditGroup({ editor, look, onDates, wide }: { editor: LayoutEditor; look: ReturnType<typeof editLook>; onDates: () => void; /** Desktop: the name is typed in its title and Photo by beside the cover, so only the dates. */ wide?: boolean }) {
  const ds = useDs();
  const { name, coverUrl, coverCredit } = editor.layout;
  const rule = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.lineStrong };
  const input = [type.caption, styles.input, { color: ds.c.ink }];
  const dateRow = (label: string, value: string, i: number, onPress: (() => void) | null) => {
    const Row = onPress ? PressableScale : View;
    return (
      <Row key={label} role={onPress ? 'button' : undefined} accessibilityLabel={`${label}: ${value}`} onPress={onPress ?? undefined} style={[styles.row, i > 0 && rule]}>
        <Body style={styles.label}>{label}</Body>
        <Caption tone="muted" style={styles.value} numberOfLines={1}>
          {value}
        </Caption>
        {onPress ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
      </Row>
    );
  };
  return (
    <View style={[styles.group, { backgroundColor: ds.c.raised }]}>
      {wide ? null : (
      <View style={styles.row}>
        <Body style={styles.label}>Name</Body>
        <TextInput value={name} onChangeText={editor.rename} aria-label="Menu name" placeholder="Name it" placeholderTextColor={ds.c.faint} maxLength={80} style={input} />
      </View>
      )}
      {look.home ? null : [dateRow('Goes on', look.goesOn, wide ? 0 : 1, look.canDate ? onDates : null), dateRow('Ends', look.ends, 2, look.canEnd ? () => editor.setSheet({ kind: 'ends' }) : null)]}
      {coverUrl && !wide ? (
        <View style={[styles.row, rule]}>
          <Body style={styles.label}>Photo by</Body>
          <TextInput
            value={coverCredit ?? ''}
            onChangeText={editor.setCoverCredit}
            aria-label="Photo by"
            placeholder="Who took it?"
            placeholderTextColor={ds.c.muted}
            maxLength={80}
            autoCapitalize="words"
            style={input}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Over the foot of the cover: Change cover and Remove; over drawings, Add a cover. A failed upload says so beside them. */
export function CoverButtons({ editor, onMedia }: { editor: LayoutEditor; onMedia: boolean }) {
  const { coverUrl } = editor.layout;
  return (
    <>
      <GlassButton
        icon="camera"
        label={editor.coverBusy ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add a cover'}
        accessibilityLabel={coverUrl ? 'Change cover' : 'Add a cover'}
        onPress={editor.pickCover}
        onMedia={onMedia}
      />
      {coverUrl ? <GlassButton icon="xmark" accessibilityLabel="Remove cover" onPress={editor.removeCover} onMedia={onMedia} /> : null}
      {editor.coverError ? (
        <Caption role="alert" tone="accent" style={styles.coverError}>
          {editor.coverError}
        </Caption>
      ) : null}
    </>
  );
}

/** The section the toolbar's Add drink adds to: the first one short of its rule, else the last. */
export function addTarget(editor: LayoutEditor): string | null {
  const { sections } = editor.layout;
  return (sections.find((s) => s.drinks.length < s.minItems) ?? sections[sections.length - 1])?.key ?? null;
}

/** Every section being edited, in order; `width` lays them out in columns on desktop. */
export function EditSections({ editor, ink, drag, width }: { editor: LayoutEditor; ink: MenuInk; drag?: MenuDrag; width?: `${number}%` }) {
  const home = !editor.menu.barId;
  const menuName = editor.layout.name.trim() || editor.menu.name;
  return editor.layout.sections.map((s) => (
    <View key={s.key} style={width ? { width, paddingHorizontal: space.xl } : undefined}>
      <EditSection
        section={s}
        barId={editor.menu.barId}
        ink={ink}
        made={editor.made}
        onSettings={() => editor.setSheet({ kind: 'section', key: s.key })}
        onAdd={() => editor.setSheet({ kind: 'add', key: s.key })}
        onRemove={(id) => editor.remove(s.key, id)}
        onReorder={(drinks) => editor.reorder(s.key, drinks)}
        onMove={(from, to) => editor.move(s.key, from, to)}
        onOpen={(d) => editor.setSheet({ kind: 'row', key: s.key, drinkId: d.id })}
        pricing={home ? undefined : (d) => ({ menuName, barId: editor.menu.barId, onPrice: (p) => editor.setPrice(d.id, p), onMenuPrice: (p) => editor.setMenuPrice(d.id, p) })}
        elsewhere={editor.elsewhere}
        drag={drag?.on ? { at: drag.at?.key === s.key ? drag.at.index : null, dragging: drag.dragging } : undefined}
      />
    </View>
  ));
}

/**
 * After the sections, in the page's grouped rows: the run sheet (saved first,
 * so every drink is on it) and the guest card. A home menu has no run sheet.
 */
export function EditAfter({ editor }: { editor: LayoutEditor }) {
  const router = useRouter();
  const go = (path: string) => async () => {
    if (await editor.persist()) router.push(`/menus/${editor.menu.id}/${path}` as Href);
  };
  const rows = [
    ...(editor.menu.barId && editor.layout.sections.some((s) => s.drinks.length) ? [{ label: 'Run sheet', value: 'Serves, swaps, who brings what', onPress: go('run-sheet') }] : []),
    { label: 'Guest card', value: 'What guests see', onPress: go('card') },
  ];
  return (
    <View style={styles.after}>
      <MenuPageGroup rows={rows} />
    </View>
  );
}

const styles = StyleSheet.create({
  after: { paddingTop: space.xl },
  group: { borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 48 },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: 'right' },
  input: { flex: 1, minWidth: 0, textAlign: 'right', paddingVertical: space.sm },
  coverError: { alignSelf: 'center', flexShrink: 1 },
});
