import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, displayName, font, menuBandHeight, nameStyle, radius, space, STATUS } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';
import { comingUpLine, draftLine, homeMenuLine, menuDateLine, menuStatus, plural } from '@/lib/menus';
import type { MenuPicture, MenuSummary } from '@/types/menus';

import { MenuVisual } from './MenuVisual';
import { MenuBand, MenuStrip } from './page/MenuBandLazy';
import { dayMonth } from '@/lib/dayMonth';

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

/** A coming-up menu's day at the start of its row: the month over the date (Menu-shelf). */
function DateTile({ start }: { start: Date }) {
  const ds = useDs();
  return (
    <View style={[styles.date, { backgroundColor: ds.c.raised }]} aria-hidden>
      <Caption tone="muted" style={styles.caps}>
        {start.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
      </Caption>
      <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {start.getDate()}
      </DsText>
    </View>
  );
}

/**
 * The first menu on a list (on now, else the next one): its drink band, its
 * name, one line, and On now or its day (menus-one-look Kit). `note` adds
 * to the line, as on a row.
 */
export function MenuCard({ menu, now, note }: { menu: MenuSummary; now: number; note?: string }) {
  const router = useRouter();
  const status = statusOf(menu, now);
  const line = [lineFor(menu, status, now), note].filter(Boolean).join(' · ');
  return (
    <MenuCardFrame
      label={`${menu.name}, ${status === 'on' ? 'on now, ' : ''}${line}`}
      onPress={() => router.push(menuHref(menu.id))}
      name={menu.name}
      coverUrl={menu.coverUrl}
      coverPosition={menu.coverPosition}
      pictures={menu.pictures}
      line={line}
    />
  );
}

interface MenuCardFrameProps {
  label: string;
  onPress: () => void;
  name: string;
  coverUrl: string | null;
  coverPosition?: number;
  pictures: MenuPicture[];
  line: string;
  trailing?: ReactNode;
}

/** The one menu card (Menu-shelf): the drinks drawn together on their sky (or the cover), then the name with a chevron and one line. A bar's menu on now draws through it too. */
export function MenuCardFrame({ label, onPress, name, coverUrl, coverPosition, pictures, line, trailing }: MenuCardFrameProps) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} style={styles.card}>
      {coverUrl || !pictures.length ? (
        <View style={styles.cover}>
          <MenuVisual name={name} coverUrl={coverUrl} coverPosition={coverPosition} pictures={pictures} height={menuBandHeight} />
        </View>
      ) : (
        <MenuBand ids={pictures.slice(0, 3).map((p) => p.id)} />
      )}
      <View style={styles.cardBody}>
        <View style={styles.flex}>
          <Headline numberOfLines={1} style={[nameStyle(ds.displayFace, displayName.card)]}>
            {name}
          </Headline>
          <Caption tone="muted" numberOfLines={1}>
            {line}
          </Caption>
        </View>
        {trailing ?? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />}
      </View>
    </PressableScale>
  );
}

/** What starts a row (Menu-shelf): a coming-up menu's day, a draft's pencil drawings in a dashed amber frame, the drinks drawn small, or R&D's grid. */
function Thumb({ menu, status }: { menu: MenuSummary; status: RowStatus }) {
  const ds = useDs();
  const start = status === 'upcoming' ? startOf(menu) : null;
  if (start) return <DateTile start={start} />;
  const ids = menu.pictures.map((p) => p.id);
  if (status === 'draft') {
    return (
      <View style={[styles.dashed, { borderColor: readableAccent(STATUS.warning, ds.c.ground) }]} aria-hidden>
        {ids.length ? <MenuStrip ids={ids} ink="pencil" /> : null}
      </View>
    );
  }
  if (status === 'rnd' || !ids.length) {
    return (
      <View style={[styles.thumb, styles.empty, { backgroundColor: ds.c.raised }]} aria-hidden>
        <IconSymbol name="square.grid.2x2" size={22} color={ds.c.muted} />
      </View>
    );
  }
  return <MenuStrip ids={ids} ink="colour" />;
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
  /** A draft: its line in amber (on a card row, a dashed edge too). */
  dashed?: boolean;
  /** A ruled row, as the Menus list draws it (Menu-shelf); otherwise the card row other lists use. */
  ruled?: boolean;
  trailing?: ReactNode;
}

/**
 * The one menu row (menus-one-look): a 56 square, the name in the display
 * face, one line, then what ends it. Your menus, and bar menus you saved or
 * collected, all draw through it.
 */
export function MenuRowFrame({ label, onPress, thumb, name, line, dashed, ruled, trailing }: MenuRowFrameProps) {
  const ds = useDs();
  return (
    <PressableScale
      role={onPress ? 'link' : undefined}
      disabled={!onPress}
      accessibilityLabel={label}
      onPress={onPress}
      style={
        ruled
          ? [styles.ruled, { borderTopColor: ds.c.lineStrong }]
          : [styles.row, dashed ? { borderColor: ds.c.lineStrong, borderStyle: 'dashed' } : { borderColor: ds.c.line, backgroundColor: ds.c.surface }]
      }
    >
      {thumb}
      <View style={styles.flex}>
        <Headline numberOfLines={1} style={[nameStyle(ds.displayFace, displayName.row)]}>
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
export function MenuListRow({ menu, now, note, ruled }: { menu: MenuSummary; now: number; note?: string; ruled?: boolean }) {
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
      ruled={ruled}
      trailing={!ruled && status === 'on' ? <Tag label="On now" tone="success" dot /> : undefined}
    />
  );
}

/** A past menu: a plain divided line, its name in the display face and its dates and count in mono. */
export function MenuPastLine({ menu }: { menu: MenuSummary }) {
  const router = useRouter();
  const short = (iso: string) => dayMonth(new Date(iso), { month: 'short' });
  const dates = menu.endsAt ? (menu.startsAt ? `${short(menu.startsAt)} to ${short(menu.endsAt)}` : `off since ${short(menu.endsAt)}`) : '';
  const count = plural(new Set(menu.itemIds).size, 'drink');
  return (
    <MenuRowFrame
      label={`${menu.name}, ${count}, ${dates}`}
      onPress={() => router.push(menuHref(menu.id))}
      thumb={null}
      name={menu.name}
      line={count}
      ruled
      trailing={
        <Caption tone="muted" style={styles.mono}>
          {dates}
        </Caption>
      }
    />
  );
}

/** The one menu line: the name in the display face, then mono dates (or a green "On now", `live`). Past menus anywhere, and a drink's menus. */
export function MenuLine({ name, line, label, live, onPress }: { name: string; line: string; label: string; live?: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} style={[styles.past, { borderBottomColor: ds.c.line }]}>
      <Headline numberOfLines={1} style={[styles.flex, { fontFamily: displayFaces[ds.displayFace].regular }]}>
        {name}
      </Headline>
      <Caption tone={live ? undefined : 'muted'} color={live ? readableAccent(STATUS.success, ds.c.ground) : undefined} numberOfLines={1} style={styles.mono}>
        {line}
      </Caption>
    </PressableScale>
  );
}

const THUMB = 56;

const styles = StyleSheet.create({
  card: { gap: space.md },
  cover: { borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous' },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
  ruled: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  fillThumb: { width: THUMB, height: THUMB },
  dashed: { width: 96, height: THUMB + space.sm, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  caps: { letterSpacing: 1, ...font.medium },
  past: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  mono: { ...font.figures },
  date: { width: THUMB, height: THUMB, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
