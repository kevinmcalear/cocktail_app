import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { Crumbs } from '@/components/nav/PageFrame';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMenuLens } from '@/hooks/useMenuLens';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { useMyBar } from '@/hooks/useHomeBar';
import { useShoppingEdit } from '@/hooks/useShoppingList';
import { isOneNightMenu, menuStatus, newDrinkIds } from '@/lib/menus';
import { menuShopping } from '@/lib/shoppingList';

import { GoLiveSheet } from './GoLiveSheet';
import { HomeNightSheet } from './HomeNight';
import { menuDrinkHref, SectionHead } from './MenuSections';
import { MenuMoreSheet } from './MenuMoreSheet';
import { ShareMenuSheet } from './ShareMenuSheet';
import { MenuPageBanner, MenuPageGroup } from './page/MenuPageGroup';
import { MenuPageHead } from './page/MenuPageHead';
import { MenuPageRow, type PageRowView } from './page/MenuPageRow';
import { menuPageModel, type GroupAction } from './page/menuPageModel';
import { MenuSpecInPlace } from './page/MenuSpecInPlace';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

type Item = { key: string; head?: { name: string; count: number }; row?: PageRowView };

/**
 * One menu page for everyone, with more on it as the role rises (2027
 * canvas, Menu-page): guests read names, what's in each and prices; the
 * floor adds allergens and talking points; bartenders the method and the
 * spec in place; the menu team Edit and each drink's cost; Admins the bar
 * page and End. Drafts stay in pencil until published; past menus fade.
 */
export function MenuScreen({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const sidebar = useIsWideWeb();
  const { width } = useWindowDimensions();
  const { venues } = useActiveVenue();
  const { data: menu, isLoading, error } = useMenu(menuId);
  const [now] = useState(() => Date.now());
  const [sheet, setSheet] = useState<'more' | 'night' | 'share' | 'publish' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const lens = useMenuLens(menu);
  const { data: venueMenus = [] } = useVenueMenus(menu?.barId ?? null);
  const shelf = useMyBar();
  const shopping = useShoppingEdit();

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
  const others = venueMenus.filter((m) => m.barId === menu.barId && m.id !== menu.id);
  const live = others.find((m) => menuStatus(m, now) === 'on');
  const previous = others.filter((m) => menuStatus(m, now) === 'previous');
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const model = menuPageModel({
    menu,
    status,
    lens,
    venueName: venues.find((v) => v.id === menu.barId)?.name ?? null,
    onNow: live ? { name: live.name, itemIds: new Set(live.itemIds) } : null,
    newIds: menu.barId && previous.length ? newDrinkIds(drinks.map((d) => d.id), previous) : undefined,
    shelf: lens.lens === 'home' && !shelf.isLoading ? shelf : null,
    day,
    now,
  });
  const team = lens.lens === 'creator' || lens.lens === 'admin';
  const home = !menu.barId;
  const draft = status === 'draft';
  const go = (href: string) => router.push(href as Href);
  // A drink opens in its menu: the drink page shows "Autumn · 4 of 8" and pages through it.
  const openDrink = (row: PageRowView) => go(`${menuDrinkHref(row.drink)}?menu=${menu.id}`);
  const share = () => (lens.lens === 'home' || isOneNightMenu(menu) ? setSheet('share') : go(`/menus/${menu.id}/card`));

  const actions: Record<Exclude<GroupAction, null>, () => void> = {
    dates: () => setSheet('more'),
    end: () => setSheet('more'),
    barPage: () => setSheet('more'),
    costing: () => go(`/menus/${menu.id}/costing`),
    runSheet: () => go(`/menus/${menu.id}/run-sheet`),
    prep: () => go('/prep'),
    offMenu: () => go('/off-menu'),
    publish: () => setSheet('publish'),
    replaces: () => (live ? go(`/menus/${live.id}`) : undefined),
    night: () => setSheet('night'),
    shopping: () => {
      if (shelf.isLoading) return;
      const adds = menuShopping(drinks, shelf.oneAway, shelf.twoAway).map((a) => ({ ...a, source: 'menu' as const }));
      if (adds.length) shopping.add.mutate(adds);
      go('/shopping');
    },
  };

  const items: Item[] = model.sections.flatMap((s) => [
    { key: `h-${s.id}`, head: { name: s.name, count: s.rows.length } },
    ...s.rows.map((row) => ({ key: `${s.id}-${row.drink.id}`, row })),
  ]);
  const column = { paddingHorizontal: gutter, maxWidth: wide ? 760 : undefined, width: '100%', alignSelf: sidebar ? 'flex-start' : 'center' } as const;
  const bartender = lens.lens === 'bartender';

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        // A menu can run to dozens of drinks: rows mount as they scroll into view.
        data={items}
        keyExtractor={(i) => i.key}
        windowSize={DRAWN_LIST_WINDOW}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + (draft && team ? 140 : space.xxxl) }}
        renderItem={({ item }) => (
          <View style={column}>
            {item.head ? (
              <View style={styles.sectionHead}>
                <SectionHead name={item.head.name} count={item.head.count} />
              </View>
            ) : item.row ? (
              <MenuPageRow
                row={item.row}
                open={bartender ? open === item.key : undefined}
                onPress={() => (bartender ? setOpen((o) => (o === item.key ? null : item.key)) : openDrink(item.row!))}
              >
                {bartender && open === item.key ? <MenuSpecInPlace itemId={item.row.drink.id} barId={menu.barId} onOpen={() => openDrink(item.row!)} /> : null}
              </MenuPageRow>
            ) : null}
          </View>
        )}
        ListHeaderComponent={
          <View style={[column, styles.head]}>
            {sidebar ? <Crumbs trail={[home ? { label: 'Drinks', href: '/drinks' } : { label: 'Menus', href: '/menus/all' }]} /> : null}
            <MenuPageHead
              heroIds={drinks.slice(0, 3).map((d) => d.id)}
              coverUrl={menu.coverUrl}
              name={menu.name}
              ink={model.ink}
              quiet={model.quiet}
              tag={model.tag}
              eyebrow={model.eyebrow}
              description={menu.description}
              onBack={sidebar ? null : back}
              onShare={lens.lens === 'home' ? null : share}
              pill={lens.lens === 'home' ? { label: 'Share', onPress: share } : team && !draft && status !== 'previous' ? { label: 'Edit', onPress: () => go(`/menus/${menu.id}/edit`) } : null}
              width={Math.min(width, 760) - gutter * 2}
            />
            {model.banner ? (
              <MenuPageBanner text={model.banner.text} aside={model.banner.aside} warn={model.banner.warn} onPress={model.banner.toNow && live ? () => go(`/menus/${live.id}`) : undefined} />
            ) : null}
            <MenuPageGroup rows={model.group.map((r) => ({ ...r, onPress: r.action ? actions[r.action] : undefined }))} />
            {!drinks.length ? <Body tone="muted">No drinks on this menu yet.</Body> : null}
          </View>
        }
        ListFooterComponent={model.after ? <Caption tone="muted" style={[column, styles.after]}>{model.after}</Caption> : undefined}
      />
      {draft && team ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md, paddingHorizontal: gutter, backgroundColor: ds.c.ground }]}>
          <Button label="Publish" variant="ink" size="lg" onPress={() => setSheet('publish')} style={styles.publish} />
          <Caption tone="muted" align="center">
            Only your team can see a draft
          </Caption>
        </View>
      ) : null}
      {sheet === 'night' ? <HomeNightSheet menu={menu} onClose={() => setSheet(null)} /> : null}
      {sheet === 'share' ? <ShareMenuSheet menu={menu} onClose={() => setSheet(null)} /> : null}
      {sheet === 'more' ? <MenuMoreSheet menu={menu} status={status} visible onClose={() => setSheet(null)} onNight={home ? () => setSheet('night') : undefined} /> : null}
      {sheet === 'publish' ? <GoLiveSheet visible menu={menu} others={others} onClose={() => setSheet(null)} onDone={() => setSheet(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { gap: space.lg },
  head: { gap: space.lg, paddingBottom: space.lg },
  sectionHead: { paddingTop: space.xl, paddingBottom: space.sm },
  after: { paddingTop: space.xl },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.md, gap: space.sm, alignItems: 'center' },
  publish: { alignSelf: 'stretch' },
});
