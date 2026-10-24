import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { displayFaces, displayName, fontFamilies, radius, space } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';
import { comingUpLine, draftLine, homeMenuLine, menuDateLine, menuStatus, plural, previousLine } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { MenuVisual } from './MenuVisual';

export const menuHref = (id: string) => `/menus/${id}` as const;

type RowStatus = ReturnType<typeof menuStatus> | 'rnd';

const statusOf = (menu: MenuSummary, now: number): RowStatus => (menu.kind === 'rnd' ? 'rnd' : menuStatus(menu, now));

/** Count, then when: "8 drinks · since Mon 1 Sep", "4 drinks · Fri 31 Oct · 8 guests". */
function metaLine(menu: MenuSummary, now: number): string {
  // A home menu has a night instead of dates on a venue's calendar.
  return [plural(new Set(menu.itemIds).size, 'drink'), homeMenuLine(menu, now), menuDateLine(menu, now)].filter(Boolean).join(' · ');
}

function lineFor(menu: MenuSummary, status: RowStatus, now: number): string {
  if (status === 'upcoming') return comingUpLine(menu, undefined, !!startOf(menu));
  if (status === 'draft') return draftLine(menu, now);
  if (status === 'rnd') return ['R&D', plural(new Set(menu.itemIds).size, 'drink'), menu.description].filter(Boolean).join(' · ');
  return metaLine(menu, now);
}

/** When a coming-up menu starts. A home menu's night is a day (2026-10-04), not an instant: read it as local midnight, even once sharing gave it a start. */
function startOf(menu: MenuSummary): Date | null {
  const startsAt = menu.event?.startsAt ?? menu.startsAt;
  if (menu.menuDate && (!startsAt || menu.barId === null)) return new Date(`${menu.menuDate}T00:00:00`);
  return startsAt ? new Date(startsAt) : null;
}

/** A coming-up menu's day: the weekday over the date, tinted in the accent. */
function DateTile({ start }: { start: Date }) {
  const ds = useDs();
  return (
    <View style={[styles.date, { backgroundColor: withAlpha(ds.accentText, 0.16) }]}>
      <Caption color={ds.accentText}>{start.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Caption>
      <DsText variant="spec" color={ds.accentText}>
        {start.getDate()}
      </DsText>
    </View>
  );
}

/** What ends a card or row: On now, a coming-up menu's day, or (for a draft or R&D) a chevron. */
function Trailing({ menu, status }: { menu: MenuSummary; status: RowStatus }) {
  const ds = useDs();
  const start = status === 'upcoming' ? startOf(menu) : null;
  if (status === 'on') return <Tag label="On now" tone="success" dot />;
  if (start) return <DateTile start={start} />;
  return status === 'draft' || status === 'rnd' ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : null;
}

/**
 * The first menu on a list (on now, else the next one): its drink band, its
 * name, one line, and On now or its day (menus-one-look Kit). `note` adds
 * to the line, as on a row.
 */
export function MenuCard({ menu, now, note }: { menu: MenuSummary; now: number; note?: string }) {
  const ds = useDs();
  const router = useRouter();
  const status = statusOf(menu, now);
  const line = [lineFor(menu, status, now), note].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${menu.name}, ${status === 'on' ? 'on now, ' : ''}${line}`}
      onPress={() => router.push(menuHref(menu.id))}
      style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
    >
      <MenuVisual name={menu.name} coverUrl={menu.coverUrl} coverPosition={menu.coverPosition} pictures={menu.pictures} height={112} />
      <View style={styles.cardBody}>
        <View style={styles.flex}>
          <Headline numberOfLines={1} style={[displayName.card, { fontFamily: displayFaces[ds.displayFace].regular }]}>
            {menu.name}
          </Headline>
          <Caption tone="muted" numberOfLines={1}>
            {line}
          </Caption>
        </View>
        <Trailing menu={menu} status={status} />
      </View>
    </PressableScale>
  );
}

/** The band cut to a square: the menu's cover or its first drink. A draft with no drinks gets a dashed slot, R&D a grid. */
function Thumb({ menu, status }: { menu: MenuSummary; status: RowStatus }) {
  const ds = useDs();
  if (menu.coverUrl || menu.pictures.length) {
    return (
      <View style={styles.thumb} aria-hidden>
        <MenuVisual name={menu.name} coverUrl={menu.coverUrl} coverPosition={menu.coverPosition} pictures={menu.pictures.slice(0, 1)} height={THUMB} />
      </View>
    );
  }
  return (
    <View style={[styles.thumb, styles.empty, { backgroundColor: status === 'rnd' ? ds.c.raised : withAlpha(ds.c.paper, 0.08) }]} aria-hidden>
      {status === 'rnd' ? <IconSymbol name="square.grid.2x2" size={22} color={ds.c.muted} /> : status === 'draft' ? <View style={[styles.slot, { borderColor: ds.c.lineStrong }]} /> : null}
    </View>
  );
}

/** A drink's picture cut to the row's square: its photo, or with none, its sketch. */
export function DrinkThumb({ itemId, imageUrl = null, name }: { itemId: string | null; imageUrl?: string | null; name: string }) {
  const ds = useDs();
  return (
    <View style={[styles.thumb, { backgroundColor: ds.c.paper }]} aria-hidden>
      <DrinkImage source={imageUrl} itemId={itemId} accessibilityLabel={name} radius={0} aspectRatio={1} thumb style={styles.fillThumb} />
    </View>
  );
}

interface MenuRowFrameProps {
  /** What a screen reader hears for the whole row. */
  label: string;
  /** None: the row only shows (a release no longer public). */
  onPress?: () => void;
  thumb: ReactNode;
  name: string;
  line: string;
  /** A draft: a dashed edge and its line in amber. */
  dashed?: boolean;
  trailing?: ReactNode;
}

/**
 * The one menu row (menus-one-look): a 56 square, the name in the display
 * face, one line, then what ends it. Your menus, and bar menus you saved or
 * collected, all draw through it.
 */
export function MenuRowFrame({ label, onPress, thumb, name, line, dashed, trailing }: MenuRowFrameProps) {
  const ds = useDs();
  return (
    <PressableScale
      role={onPress ? 'link' : undefined}
      disabled={!onPress}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, dashed ? { borderColor: ds.c.lineStrong, borderStyle: 'dashed' } : { borderColor: ds.c.line, backgroundColor: ds.c.surface }]}
    >
      {thumb}
      <View style={styles.flex}>
        <Headline numberOfLines={1} style={[displayName.row, { fontFamily: displayFaces[ds.displayFace].regular }]}>
          {name}
        </Headline>
        <Caption tone="muted" color={dashed ? readableAccent(STATUS.warning, ds.c.ground) : undefined} numberOfLines={1}>
          {line}
        </Caption>
      </View>
      {trailing === undefined && onPress ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : trailing}
    </PressableScale>
  );
}

/**
 * A menu in a list, the same in both modes: a square of its first drink, its
 * name in the display face, one line, then On now, its day, or a chevron. A
 * draft is dashed, its line in amber saying what's missing. `note` adds to
 * the line, like how many of the drinks you can make at home.
 */
export function MenuListRow({ menu, now, note }: { menu: MenuSummary; now: number; note?: string }) {
  const router = useRouter();
  const status = statusOf(menu, now);
  const draft = status === 'draft';
  const line = [status === 'upcoming' ? null : menu.event?.name, lineFor(menu, status, now), note].filter(Boolean).join(' · ');
  return (
    <MenuRowFrame
      label={[menu.name, status === 'on' ? 'on now' : draft ? 'draft' : null, line].filter(Boolean).join(', ')}
      onPress={() => router.push(menuHref(menu.id))}
      thumb={<Thumb menu={menu} status={status} />}
      name={menu.name}
      line={line}
      dashed={draft}
      trailing={<Trailing menu={menu} status={status} />}
    />
  );
}

/** A past menu: a plain divided line, its name in the display face and its dates and count in mono. */
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

const THUMB = 56;

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', borderCurve: 'continuous' },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg - 2 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.lg - 2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  fillThumb: { width: THUMB, height: THUMB },
  slot: { width: 22, height: 32, borderRadius: radius.mark + 1, borderWidth: 1.5, borderStyle: 'dashed' },
  past: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  mono: { fontFamily: fontFamilies.mono },
  date: { width: 44, paddingVertical: space.xs, borderRadius: radius.control, alignItems: 'center' },
});
