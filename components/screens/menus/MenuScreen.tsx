import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Display, DsText, GlassButton, PressableScale, Tag, useBreakpoint, useDs, useGutter, type IconName } from '@/components/ds';
import { Crumbs } from '@/components/nav/PageFrame';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { DrinkHero } from '@/components/screens/drink/DrinkHero';
import { RunSheetLink } from '@/components/screens/runSheet/parts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { useMyBar } from '@/hooks/useHomeBar';
import { shelfReady } from '@/lib/collectionMenus';
import { groupMenus, homeNightTag, isOneNightMenu, menuDateLine, menuStatus, newDrinkIds, plural } from '@/lib/menus';
import type { MenuStatus } from '@/types/menus';

import { HomeNightSheet } from './HomeNight';
import { MenuMoreSheet } from './MenuMoreSheet';
import { MenuPageRowView, menuPageRows } from './MenuSections';
import { MenuVisual } from './MenuVisual';
import { ShareMenuSheet } from './ShareMenuSheet';

const STATUS_LABEL: Record<MenuStatus, string> = { on: 'On now', upcoming: 'Coming up', draft: 'Draft', previous: 'Past' };
// Not the accent for Coming up: Edit is the page's one accent.
const STATUS_TONE = { on: 'success', upcoming: 'default', draft: 'default', previous: 'default' } as const;

export function MenuAction({ label, icon, onPress, primary }: { label: string; icon: IconName; onPress: () => void; primary?: boolean }) {
  const ds = useDs();
  const ink = primary ? ds.accentFill.text : ds.c.ink;
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.action,
        primary ? { backgroundColor: ds.accentFill.fill } : { backgroundColor: ds.c.surface, borderColor: ds.c.line, borderWidth: 1 },
      ]}
    >
      <IconSymbol name={icon} size={20} color={ink} />
      <DsText variant="caption" color={ink}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/**
 * One menu, set like the printed menu, with what you can do with it: edit,
 * share, study and prep. Drinks open their own pages.
 */
export function MenuScreen({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  // Wide web: the sidebar is the way around, so crumbs instead of Back, and the page sits left.
  const sidebar = useIsWideWeb();
  const { has } = useVenueFeatures();
  const { venues } = useActiveVenue();
  const { data: menu, isLoading, error } = useMenu(menuId);
  const [now] = useState(() => Date.now());
  const [more, setMore] = useState(false);
  const [night, setNight] = useState(false);
  const [sharing, setSharing] = useState(false);
  const userId = useUserId();
  const caps = useCapabilities(menu?.barId);
  const { data: venueMenus } = useVenueMenus(menu?.barId ?? null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/menus/all'));
  if (!menu) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
        <Body tone="muted">{isLoading ? 'Opening the menu…' : error ? 'Couldn’t load this menu. Try again in a moment.' : 'This menu isn’t there any more, or it isn’t yours to see.'}</Body>
      </View>
    );
  }

  const status = menuStatus(menu, now);
  const venue = venues.find((v) => v.id === menu.barId);
  const drinkCount = menu.sections.reduce((n, s) => n + s.drinks.length, 0);
  // Its cover photo, or with none, its first drinks' own pictures (sketches where there's no photo).
  const pictures = menu.sections.flatMap((s) => s.drinks);
  // Both modes open on the drink band (menus-one-look); paper is only for what guests see.
  const home = !menu.barId;
  const hero = !!menu.coverUrl || pictures.length > 0;
  const go = (href: string) => router.push(href as Href);
  const canEdit = menu.barId ? Array.isArray(caps.data) && caps.data.includes('menus') : menu.createdBy === userId;
  // NEW: a venue's drinks no menu that has finished had.
  const previous = menu.barId ? groupMenus((venueMenus ?? []).filter((m) => m.barId === menu.barId && m.id !== menu.id), now).previous : [];
  const fresh = previous.length ? newDrinkIds(pictures.map((d) => d.id), previous) : undefined;
  // A home menu, or a venue's one-night menu, shares as a link without going live (b15); other venue menus as the guest card.
  const shareable = canEdit && (!menu.barId || isOneNightMenu(menu));
  const column = { paddingHorizontal: gutter, maxWidth: wide ? 760 : undefined, alignSelf: sidebar ? 'flex-start' : 'center' } as const;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        // A menu can run to dozens of drinks: rows mount as they scroll into view.
        data={drinkCount ? menuPageRows(menu.sections) : []}
        keyExtractor={(r) => r.key}
        windowSize={DRAWN_LIST_WINDOW}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
        renderItem={({ item }) => (
          <View style={[styles.body, column]}>
            <MenuPageRowView row={item} newIds={fresh} firstGap={space.sm} />
          </View>
        )}
        ListHeaderComponent={
          <>
            {menu.coverUrl ? (
              <DrinkHero name={menu.name} pictures={[{ url: menu.coverUrl, isSketch: false, isOutdated: false }]} glass={null} height={wide ? 360 : 320} fade />
            ) : hero ? (
              <MenuVisual name={menu.name} coverUrl={null} pictures={pictures} height={wide ? 360 : 320} fade scroll />
            ) : (
              <View style={{ height: sidebar ? space.xxl + space.sm : insets.top + 72 }} />
            )}
            <View style={[styles.body, styles.head, column, { marginTop: hero ? -84 : 0 }]}>
              {sidebar ? <Crumbs trail={[home ? { label: 'Collection', href: '/collection' } : { label: 'Menus', href: '/menus/all' }]} /> : null}
              {/* A solid ground behind it: it sits on the photo, which can be light or dark. */}
              {home ? (
                // A home menu isn't on a venue's calendar: its tag is its night.
                <Tag label={homeNightTag(menu.menuDate, now)} tone={status === 'on' ? 'success' : status === 'upcoming' ? 'accent' : 'default'} dot={status === 'on'} style={{ backgroundColor: ds.c.ground }} />
              ) : (
                <Tag label={[menu.kind === 'rnd' ? 'R&D' : STATUS_LABEL[status], menuDateLine(menu, now)].filter(Boolean).join(' ')} tone={STATUS_TONE[status]} dot={status === 'on'} style={{ backgroundColor: ds.c.ground }} />
              )}
              <Display>{menu.name}</Display>
              {home ? (
                <HomeMeta itemIds={pictures.map((d) => d.id)} guests={menu.guestCount} />
              ) : (
                <Caption tone="muted">{[venue?.name, plural(drinkCount, 'drink'), plural(menu.sections.length, 'section')].filter(Boolean).join(' · ')}</Caption>
              )}
              <View style={styles.actions}>
                {canEdit ? <MenuAction label="Edit" icon="pencil" primary onPress={() => go(`/menus/${menu.id}/edit`)} /> : null}
                {canEdit && !menu.barId ? <MenuAction label="Date and guests" icon="calendar" onPress={() => setNight(true)} /> : null}
                <MenuAction label="Share" icon="square.and.arrow.up" onPress={() => (shareable ? setSharing(true) : go(`/menus/${menu.id}/card`))} />
                {has('study') && status === 'on' ? <MenuAction label="Study" icon="book" onPress={() => go('/study/tonight')} /> : null}
                {has('prep') && (status === 'on' || status === 'upcoming') ? <MenuAction label="Prep" icon="flask" onPress={() => go('/prep')} /> : null}
                {menu.barId && Array.isArray(caps.data) && caps.data.includes('costs') ? <MenuAction label="Costing" icon="dollarsign.circle.fill" onPress={() => go(`/menus/${menu.id}/costing`)} /> : null}
              </View>
              {canEdit && drinkCount > 0 ? <RunSheetLink menuId={menu.id} /> : null}
              {drinkCount === 0 ? <Body tone="muted">No drinks on this menu yet.</Body> : null}
            </View>
          </>
        }
      />
      <View style={[styles.topBar, { top: insets.top + space.sm, paddingHorizontal: gutter }]}>
        {sidebar ? <View /> : <GlassButton icon="chevron.left" accessibilityLabel={home ? 'Back' : 'Back to Menus'} onPress={back} onMedia={!!hero} />}
        {canEdit ? <GlassButton icon="ellipsis" accessibilityLabel="More: duplicate, take off, file under R&D, delete" onPress={() => setMore(true)} onMedia={!!hero} /> : null}
      </View>
      {night ? <HomeNightSheet menu={menu} onClose={() => setNight(false)} /> : null}
      {sharing ? <ShareMenuSheet menu={menu} onClose={() => setSharing(false)} /> : null}
      {/* Going on and off is the venue calendar (startsAt, endsAt): a home menu's night doesn't change it. */}
      {more ? <MenuMoreSheet menu={menu} status={status} visible onClose={() => setMore(false)} /> : null}
    </View>
  );
}

/** "4 drinks, 3 you can make · 8 guests": a home menu's count, what your shelf makes, and who's coming. */
function HomeMeta({ itemIds, guests }: { itemIds: string[]; guests: number | null }) {
  const bar = useMyBar();
  const { ready, total } = shelfReady(itemIds, bar.canMakeIds, bar.oneAway);
  const count = [plural(total, 'drink'), ready ? `${ready} you can make` : null].filter(Boolean).join(', ');
  return <Caption tone="muted">{[count, guests ? plural(guests, 'guest') : null].filter(Boolean).join(' · ')}</Caption>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { gap: space.lg },
  body: { width: '100%' },
  head: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md, marginBottom: space.lg },
  action: { flex: 1, minHeight: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', gap: space.xs, borderCurve: 'continuous' },
  topBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
});
