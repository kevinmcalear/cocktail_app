import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { displayFaces, font, radius, space, STATUS } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { readableAccent } from '@/lib/color';
import { menuStatus, plural } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { menuHref } from './MenuRows';
import { MenuStrip } from './page/MenuBand';
import { dayMonth } from '@/lib/dayMonth';

const short = (iso: string) => dayMonth(new Date(iso), { month: 'short' });

/** "1 to 30 Sep", "On now" (with "from 1 Oct" in its line). */
function datesOf(m: MenuSummary, on: boolean): string {
  if (on) return 'On now';
  if (m.startsAt && m.endsAt) return `${short(m.startsAt)} to ${short(m.endsAt)}`;
  return m.endsAt ? `off since ${short(m.endsAt)}` : '';
}

/**
 * Past menus as a timeline (2027 canvas, Menu-p-timeline, P1): years down a
 * rule, each menu with its dates and a strip of its drawings, faded; the one
 * on now keeps its colour and a green dot.
 */
export function PastMenusScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
  const { active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const barId = home ? null : (active?.id ?? null);
  const { data: menus = [], isLoading, error } = useVenueMenus(barId);
  const [now] = useState(() => Date.now());
  const green = readableAccent(STATUS.success, ds.c.ground);

  const shown = menus
    .filter((m) => m.barId === barId && m.kind === 'menu')
    .map((m) => ({ m, status: menuStatus(m, now) }))
    .filter((x) => x.status === 'on' || x.status === 'previous')
    .sort((a, b) => Date.parse(b.m.startsAt ?? b.m.createdAt) - Date.parse(a.m.startsAt ?? a.m.createdAt));
  const years = [...new Set(shown.map((x) => new Date(x.m.startsAt ?? x.m.createdAt).getFullYear()))];

  return (
    <ScrollView style={{ backgroundColor: ds.c.ground }} contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
      <PageHeader
        title="Past menus"
        display
        above={
          <Caption tone="muted" style={styles.caps}>
            {(barId ? (active?.name ?? '') : 'At home').toUpperCase()}
          </Caption>
        }
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/menus/all'))}
        backLabel="Back to Menus"
        crumbs={[{ label: 'Menus', href: '/menus/all' }]}
      />
      {error ? <Body tone="muted">Couldn’t load the past menus. Try again in a moment.</Body> : null}
      {!isLoading && !error && !shown.length ? <Body tone="muted">No menus have ended yet.</Body> : null}
      {years.map((year) => {
        const inYear = shown.filter((x) => new Date(x.m.startsAt ?? x.m.createdAt).getFullYear() === year);
        return (
          <View key={year} style={styles.year}>
            <View style={styles.yearHead}>
              <Caption tone="muted" role="heading" style={[styles.caps, styles.grow]}>
                {String(year)}
              </Caption>
              <Caption tone="muted" style={styles.caps}>
                {plural(inYear.length, 'menu').toUpperCase()}
              </Caption>
            </View>
            <View style={[styles.rule, { borderLeftColor: ds.c.lineStrong }]}>
              {inYear.map(({ m, status }) => {
                const on = status === 'on';
                const line = [on && m.startsAt ? `from ${short(m.startsAt)}` : null, plural(new Set(m.itemIds).size, 'drink')].filter(Boolean).join(' · ');
                return (
                  <PressableScale key={m.id} role="link" accessibilityLabel={`${m.name}, ${datesOf(m, on)}, ${line}`} onPress={() => router.push(menuHref(m.id))} style={styles.entry}>
                    <View style={[styles.dot, { backgroundColor: on ? green : ds.c.muted }]} />
                    <View style={styles.nameRow}>
                      <Headline numberOfLines={1} style={[styles.grow, { fontFamily: displayFaces[ds.displayFace].regular }]}>
                        {m.name}
                      </Headline>
                      <Caption color={on ? green : ds.c.muted} style={font.figures}>
                        {datesOf(m, on)}
                      </Caption>
                    </View>
                    <Caption tone="muted">{line}</Caption>
                    {m.pictures.length ? <MenuStrip ids={m.pictures.map((p) => p.id)} ink={on ? 'colour' : 'faded'} wide /> : null}
                  </PressableScale>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xl },
  caps: { letterSpacing: 1.5, ...font.medium },
  grow: { flex: 1 },
  year: { gap: space.md },
  yearHead: { flexDirection: 'row', alignItems: 'center' },
  rule: { borderLeftWidth: StyleSheet.hairlineWidth, marginLeft: space.sm, paddingLeft: space.xl, gap: space.xl },
  entry: { gap: space.xs },
  dot: { position: 'absolute', left: -space.xl - 4, top: space.sm, width: 9, height: 9, borderRadius: radius.pill },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
