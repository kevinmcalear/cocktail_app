import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';
import { comingUpLine, draftLine, homeMenuLine, menuDateLine, menuStatus, plural, previousLine } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { MenuVisual } from './MenuVisual';

export const menuHref = (id: string) => `/menus/${id}` as const;

function metaLine(menu: MenuSummary, now: number): string {
  // A home menu has a night instead of dates on a venue's calendar.
  return [homeMenuLine(menu, now), plural(menu.itemIds.length, 'drink'), menuDateLine(menu, now)].filter(Boolean).join(' · ');
}

/** A menu that's on now: its cover, name, and how long it's been on. */
export function MenuCard({ menu, now }: { menu: MenuSummary; now: number }) {
  const ds = useDs();
  const router = useRouter();
  const on = menuStatus(menu, now) === 'on';
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${menu.name}, ${on ? 'on now, ' : ''}${metaLine(menu, now)}`}
      onPress={() => router.push(menuHref(menu.id))}
      style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
    >
      <MenuVisual name={menu.name} coverUrl={menu.coverUrl} coverPosition={menu.coverPosition} pictures={menu.pictures} height={112} />
      <View style={styles.cardBody}>
        <View style={styles.flex}>
          <DsText variant="title" numberOfLines={1}>
            {menu.name}
          </DsText>
          <Caption tone="muted">{metaLine(menu, now)}</Caption>
        </View>
        {on ? <Tag label="On now" tone="success" /> : null}
      </View>
    </PressableScale>
  );
}

/** Tonight's card for a menu that's on: a small cover, its name, "On now · 8 drinks · since 1 Sep", and a chevron. */
export function MenuOnRow({ menu, now }: { menu: MenuSummary; now: number }) {
  const ds = useDs();
  const router = useRouter();
  const meta = ['On now', plural(menu.itemIds.length, 'drink'), menuDateLine(menu, now, undefined, true)].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${menu.name}, ${meta}`}
      onPress={() => router.push(menuHref(menu.id))}
      style={[styles.row, styles.onRow, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
    >
      <View style={styles.thumb} aria-hidden>
        <MenuVisual name={menu.name} coverUrl={menu.coverUrl} coverPosition={menu.coverPosition} pictures={menu.pictures} height={48} />
      </View>
      <View style={styles.flex}>
        <Headline numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {menu.name}
        </Headline>
        <Caption tone="muted" numberOfLines={1}>
          {meta}
        </Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * A menu in a list: coming up (a date tile tinted in the accent, then the kind,
 * drinks and date: "One night · 4 drinks · Fri 31 Oct"), a draft (dashed,
 * with an amber "1 section short · edited yesterday"), or an R&D collection
 * (an R&D tile, "R&D · 4 drinks · a control and three trials"). Names in the
 * venue's display face; only drafts and R&D carry a chevron. `note` adds a
 * line of its own, like how many of the drinks you can make at home.
 */
export function MenuListRow({ menu, now, note }: { menu: MenuSummary; now: number; note?: string }) {
  const ds = useDs();
  const router = useRouter();
  const status = menu.kind === 'rnd' ? 'rnd' : menuStatus(menu, now);
  const startsAt = menu.event?.startsAt ?? menu.startsAt;
  // A home menu's night is a day (2026-10-04), not an instant: read it as local midnight.
  const start = status !== 'upcoming' ? null : startsAt ? new Date(startsAt) : menu.menuDate ? new Date(`${menu.menuDate}T00:00:00`) : null;
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  const drinks = plural(new Set(menu.itemIds).size, 'drink');
  const meta =
    status === 'upcoming' ? comingUpLine(menu) : status === 'draft' ? draftLine(menu, now) : status === 'rnd' ? ['R&D', drinks, menu.description].filter(Boolean).join(' · ') : metaLine(menu, now);
  const label = [status === 'upcoming' ? null : menu.event?.name, meta, note].filter(Boolean).join(' · ');
  const chevron = status === 'draft' || status === 'rnd';
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[menu.name, status === 'draft' ? 'draft' : null, label].filter(Boolean).join(', ')}
      onPress={() => router.push(menuHref(menu.id))}
      style={[
        styles.row,
        { borderColor: status === 'draft' ? ds.c.lineStrong : ds.c.line, borderStyle: status === 'draft' ? 'dashed' : 'solid' },
        status !== 'draft' && { backgroundColor: ds.c.surface },
      ]}
    >
      {start ? (
        <View style={[styles.date, { backgroundColor: withAlpha(ds.accentText, 0.16) }]}>
          <Caption color={ds.accentText}>{start.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Caption>
          <DsText variant="spec" color={ds.accentText}>
            {start.getDate()}
          </DsText>
        </View>
      ) : status === 'rnd' ? (
        <View style={[styles.tile, { backgroundColor: ds.c.raised }]} aria-hidden>
          <IconSymbol name="square.grid.2x2" size={22} color={ds.c.muted} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Headline numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {menu.name}
        </Headline>
        <Caption tone="muted" color={status === 'draft' ? amber : undefined} numberOfLines={1}>
          {label}
        </Caption>
      </View>
      {chevron ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : null}
    </PressableScale>
  );
}

/** A previous menu: a plain divided line, its name in the display face and its dates and count in mono. */
export function MenuPastLine({ menu }: { menu: MenuSummary }) {
  const ds = useDs();
  const router = useRouter();
  const line = previousLine(menu);
  return (
    <PressableScale role="link" accessibilityLabel={`${menu.name}, ${line} drinks`} onPress={() => router.push(menuHref(menu.id))} style={[styles.past, { borderBottomColor: ds.c.line }]}>
      <Headline numberOfLines={1} style={[styles.flex, { fontFamily: displayFaces[ds.displayFace].regular }]}>
        {menu.name}
      </Headline>
      <Caption tone="muted" style={styles.mono}>
        {line}
      </Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', borderCurve: 'continuous' },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  flex: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  onRow: { paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 48, height: 48, borderRadius: radius.control, overflow: 'hidden' },
  tile: { width: 48, height: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  past: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  mono: { fontFamily: fontFamilies.mono },
  date: { width: 52, paddingVertical: space.xs, borderRadius: radius.control, alignItems: 'center' },
});
