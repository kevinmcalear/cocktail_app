import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { homeMenuLine, menuDateLine, menuStatus, plural } from '@/lib/menus';
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

/**
 * A menu in a list: coming up (with its date), a draft (dashed, still being
 * built: a venue menu with no dates, or a home menu with no night), previous
 * (its dates), or an R&D collection (solid, never dated). `note` adds a line
 * of its own, like how many of the drinks you can make at home.
 */
export function MenuListRow({ menu, now, note }: { menu: MenuSummary; now: number; note?: string }) {
  const ds = useDs();
  const router = useRouter();
  const status = menu.kind === 'rnd' ? 'rnd' : menuStatus(menu, now);
  const startsAt = menu.event?.startsAt ?? menu.startsAt;
  // A home menu's night is a day (2026-10-04), not an instant: read it as local midnight.
  const start = status !== 'upcoming' ? null : startsAt ? new Date(startsAt) : menu.menuDate ? new Date(`${menu.menuDate}T00:00:00`) : null;
  // With the date block showing, the caption doesn't repeat the date.
  const meta = start ? [menu.guestCount ? plural(menu.guestCount, 'guest') : null, plural(menu.itemIds.length, 'drink')].filter(Boolean).join(' · ') : metaLine(menu, now);
  const label = [menu.event?.name, meta, note].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[menu.name, status === 'draft' ? 'draft' : null, menu.event?.name, metaLine(menu, now), note].filter(Boolean).join(', ')}
      onPress={() => router.push(menuHref(menu.id))}
      style={[
        styles.row,
        { borderColor: status === 'draft' ? ds.c.lineStrong : ds.c.line, borderStyle: status === 'draft' ? 'dashed' : 'solid' },
        status !== 'draft' && { backgroundColor: ds.c.surface },
      ]}
    >
      {start ? (
        <View style={[styles.date, { backgroundColor: ds.c.raised }]}>
          <Caption tone="muted">{start.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Caption>
          <DsText variant="spec">{start.getDate()}</DsText>
        </View>
      ) : null}
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{menu.name}</Headline>
        <Caption tone="muted" numberOfLines={1}>
          {label}
        </Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
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
  date: { width: 52, paddingVertical: space.xs, borderRadius: radius.control, alignItems: 'center' },
});
