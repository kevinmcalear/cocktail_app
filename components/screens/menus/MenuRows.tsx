import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { menuDateLine, menuStatus, plural } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

export const menuHref = (id: string) => `/menus/${id}` as const;

function metaLine(menu: MenuSummary, now: number): string {
  return [plural(menu.itemIds.length, 'drink'), menuDateLine(menu, now)].filter(Boolean).join(' · ');
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
      {menu.coverUrl ? (
        <Image
          source={{ uri: menu.coverUrl }}
          contentFit="cover"
          contentPosition={{ top: `${menu.coverPosition}%`, left: '50%' }}
          style={styles.cover}
          accessible={false}
        />
      ) : null}
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
 * built), or previous (its dates).
 */
export function MenuListRow({ menu, now }: { menu: MenuSummary; now: number }) {
  const ds = useDs();
  const router = useRouter();
  const status = menuStatus(menu, now);
  const start = status === 'upcoming' ? new Date(menu.event?.startsAt ?? menu.startsAt!) : null;
  // With the date block showing, the caption doesn't repeat the date.
  const meta = start ? plural(menu.itemIds.length, 'drink') : metaLine(menu, now);
  const label = menu.event ? `${menu.event.name} · ${meta}` : meta;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[menu.name, status === 'draft' ? 'draft' : null, menu.event?.name, metaLine(menu, now)].filter(Boolean).join(', ')}
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
  cover: { width: '100%', height: 112 },
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
