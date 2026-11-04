import { useIsFocused, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { DrawingBar } from '@/components/ds/DrawingBar';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { layout, menuCover, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useOffTonight } from '@/hooks/useListAsks';
import { useEndedRuns } from '@/hooks/useLivingList';
import { useMenuLens } from '@/hooks/useMenuLens';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { useMyBar } from '@/hooks/useHomeBar';
import { usePhotoTone } from '@/hooks/usePhotoTone';
import { useShoppingEdit } from '@/hooks/useShoppingList';
import { isLivingList } from '@/lib/menuLens';
import { inMenuQuery, pagerPlace } from '@/lib/menuPager';
import { isOneNightMenu, menuStatus, newDrinkIds } from '@/lib/menus';
import { menuShopping } from '@/lib/shoppingList';
import type { ShelfMatch } from '@/lib/shelfReach';
import type { MenuDetail, MenuDrink } from '@/types/menus';

import { GoLiveSheet } from './GoLiveSheet';
import { HomeNightSheet } from './HomeNight';
import { menuDrinkHref } from './MenuSections';
import { SectionHead } from './SectionHead';
import { MenuMoreSheet } from './MenuMoreSheet';
import { ShareMenuSheet } from './ShareMenuSheet';
import { DailyListPage } from './page/DailyListPage';
import { MenuPageAfter, MenuPageGroup } from './page/MenuPageGroup';
import { MenuPageBanner } from './page/MenuPageBanner';
import { menuBarTools, MenuScreenHead } from './page/MenuScreenHead';
import { MenuPinnedBar } from './page/MenuPinnedBar';
import { DeskChosenRow, MenuDeskColumns, useDeskColumn } from './desk/MenuDesk';
import { MenuPageRow, type PageRowView } from './page/MenuPageRow';
import { menuPageModel, type GroupAction } from './page/menuPageModel';
import { moreExtras, splitGroup } from './page/menuPageSplit';
import { MenuSpecInPlace, OpenDrinkLink } from './page/MenuSpecInPlace';
import { ChangeLog } from './page/LiveChangeSheet';
import { RowChanges, useRowActs, type ChangeTarget } from './page/RowChanges';
import { useLiveSections } from './page/useLiveSections';
import { dayMonth } from '@/lib/dayMonth';
import { useMenuPageActions, type PageSheet } from './page/useMenuPageActions';

// The desktop's drink beside the menu loads with it, not with every menu page (Menu-desk).
const MenuDrinkPane = lazy(() => import('./pager/MenuDrinkPane').then((m) => ({ default: m.MenuDrinkPane })));
const day = (iso: string) => dayMonth(new Date(iso), { weekday: 'short', month: 'short' });
type Item = { key: string; head?: { name: string; count: number }; row?: PageRowView; sectionId?: string };

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
  const { data: menu, isLoading, error } = useMenu(menuId);
  if (!menu) {
    const back = () => (router.canGoBack() ? router.back() : router.replace('/menus/all'));
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
        <Body tone="muted">{isLoading ? 'Opening the menu…' : error ? 'Couldn’t load this menu. Try again in a moment.' : 'This menu isn’t there any more, or it isn’t yours to see.'}</Body>
      </View>
    );
  }
  // Only a home menu reads your shelf; drinks draw in the bar's glassware (a home menu's in stock glasses).
  return <DrawingBar barId={menu.barId}>{menu.barId ? <MenuPage menu={menu} shelf={null} /> : <HomeMenuPage menu={menu} />}</DrawingBar>;
}

function HomeMenuPage({ menu }: { menu: MenuDetail }) {
  const router = useRouter();
  const shelf = useMyBar();
  const shopping = useShoppingEdit();
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const needs = shelf.isLoading ? [] : menuShopping(drinks, shelf.oneAway, shelf.twoAway);
  const toShopping = () => {
    if (shelf.isLoading) return;
    if (needs.length) shopping.add.mutate(needs.map((a) => ({ ...a, source: 'menu' as const })));
    router.push('/shopping' as Href);
  };
  return <MenuPage menu={menu} shelf={shelf.isLoading ? null : { match: shelf, toShopping, toBuy: needs.length }} />;
}

type PageProps = { menu: MenuDetail; shelf: { match: ShelfMatch; toShopping: () => void; toBuy: number | null } | null };

// A bar's menu that's on or coming up leads with its cover photo, which sets light or dark
// for the page (Menu-g-photo-dark, Menu-g-photo-bright). Drafts, past and home menus are drawn.
function MenuPage(props: PageProps) {
  const [now] = useState(() => Date.now());
  const status = menuStatus(props.menu, now);
  const cover = props.menu.barId && status !== 'draft' && status !== 'previous' ? props.menu.coverUrl : null;
  const [tone, focused] = [usePhotoTone(cover), useIsFocused()];
  // A daily list that's on is Tonight (Menu-l-tonight-*); its draft and past runs read as menus.
  if (props.menu.listType === 'daily' && status === 'on') return <DailyListPage menu={props.menu} />;
  return (
    <BackbarTheme scheme={cover ? tone : undefined}>
      {/* The page's tone can differ from the phone's, so the clock and battery follow the page; only while it's on top, or a page pushed over it keeps this style. */}
      {cover && focused ? <StatusBar style={tone === 'dark' ? 'light' : 'dark'} /> : null}
      <MenuPageBody {...props} cover={cover} now={now} />
    </BackbarTheme>
  );
}

function MenuPageBody({ menu, shelf, cover, now }: PageProps & { cover: string | null; now: number }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const sidebar = useIsWideWeb();
  const { venues } = useActiveVenue();
  const [sheet, setSheet] = useState<PageSheet>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [changing, setChanging] = useState<ChangeTarget | null>(null);
  const lens = useMenuLens(menu);
  // Only drinks that left after it went on: edits to a draft don't make it a living list.
  const ended = useEndedRuns(lens.lens === 'creator' || lens.lens === 'admin' ? menu.id : null).data ?? [];
  const endedRuns = menu.startsAt ? ended.filter((r) => Date.parse(r.cameOff) > Date.parse(menu.startsAt!)).length : 0;
  const { data: venueMenus = [] } = useVenueMenus(menu.barId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/menus/all'));
  const [collapsed, setCollapsed] = useState(false);

  const status = menuStatus(menu, now);
  const others = venueMenus.filter((m) => m.barId === menu.barId && m.id !== menu.id);
  const live = others.find((m) => menuStatus(m, now) === 'on');
  const previous = others.filter((m) => menuStatus(m, now) === 'previous');
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const offTonight = useOffTonight(lens.lens === 'employee' && status === 'on' ? menu.barId : null).data;
  const model = menuPageModel({
    menu,
    status,
    lens,
    venueName: venues.find((v) => v.id === menu.barId)?.name ?? null,
    onNow: live ? { name: live.name, endsAt: live.endsAt, itemIds: new Set(live.itemIds) } : null,
    newIds: menu.barId && previous.length ? newDrinkIds(drinks.map((d) => d.id), previous) : undefined,
    shelf: lens.lens === 'home' ? (shelf?.match ?? null) : null,
    toBuy: shelf?.toBuy ?? null,
    day,
    now,
    offTonight: new Set(offTonight?.filter((o) => o.menuId === menu.id).map((o) => o.itemId)),
  });
  const team = lens.lens === 'creator' || lens.lens === 'admin';
  const home = !menu.barId;
  const draft = status === 'draft';
  const { actions, go } = useMenuPageActions({ menu, status, liveId: live?.id ?? null, setSheet, toShopping: shelf?.toShopping });
  // The desktop (Menu-desk): a chosen cocktail opens beside the menu (a beer or wine on its own page). Elsewhere it opens in its menu, with "Autumn · 4 of 8" and the pager.
  const [picked, setPicked] = useState<string | null>(null);
  const besideId = sidebar ? ((picked && drinks.some((d) => d.id === picked) ? picked : null) ?? drinks.find((d) => d.kind === 'cocktail')?.id ?? null) : null;
  // The pane steps through the cocktails it can show beside the list; a beer or wine opens its own page from its row.
  const place = besideId ? pagerPlace(menu.name, menu.sections.flatMap((s) => s.drinks), besideId, (d) => d.kind === 'cocktail') : null;
  const openDrink = (d: MenuDrink) => (sidebar && d.kind === 'cocktail' ? setPicked(d.id) : go(`${menuDrinkHref(d)}?${inMenuQuery(menu.id)}`));
  const share = () => (lens.lens === 'home' || isOneNightMenu(menu) ? setSheet('share') : go(`/menus/${menu.id}/card`));
  const edit = () => go(`/menus/${menu.id}/edit`);
  const barTools = menuBarTools({ home: lens.lens === 'home', team, draft, past: status === 'previous', onShare: share, onEdit: edit, onMore: () => setSheet('more') });

  // A list that's on, or coming up: its drinks change one at a time, on the row (Menu-l-swap); a bartender asks (Menu-l-ask).
  const bartender = lens.lens === 'bartender';
  const current = !!menu.barId && (status === 'on' || status === 'upcoming');
  const changeable = team && current;
  const livingList = current && isLivingList(lens.rows, menu.startsAt, endedRuns);
  const living = changeable && livingList;
  const acts = useRowActs(menu, lens.rows, bartender);
  const listView = useLiveSections({ menu, sections: model.sections, rows: lens.rows, may: acts.may ?? false, on: changeable || (bartender && current), bartender, living, now });
  // A section with nothing in it isn't drawn (the editor still shows it, to fill).
  const shown = [...(listView.lead ? [listView.lead] : []), ...listView.main, ...(listView.coming ? [listView.coming] : [])].filter((s) => s.rows.length);
  const items: Item[] = shown.flatMap((s) => [
    { key: `h-${s.id}`, head: { name: s.name, count: s.rows.filter((r) => !r.struck).length } },
    // A drink can be in two asks, or an ask and a waiting row: the ask keys it.
    ...s.rows.map((row) => ({ key: `${s.id}-${row.ask ? `${row.ask.id}-` : ''}${row.drink.id}${row.struck ? '-off' : ''}`, row, sectionId: s.id })),
  ]);
  // Rows the board doesn't draw on this page (an Admin's Run sheet; a living list's run sheet and End) are in More, never piled under the drinks.
  const [topRows, moreRows] = splitGroup(model.group, living, lens.lens === 'admin');
  const withPress = <R extends { action: GroupAction }>(r: R) => ({ ...r, onPress: r.action ? actions[r.action] : undefined });
  // The desktop's menu fills the window up to the pane beside it (Menu-desk, Menu-l-desk); elsewhere it's one centred column.
  const deskColumn = useDeskColumn();
  const column = sidebar ? deskColumn : ({ paddingHorizontal: gutter, maxWidth: wide ? menuCover.column : undefined, width: '100%', alignSelf: 'center' } as const);
  // Waiting changes, Undo, Back on and Coming up show their buttons; any other row shows Swap and Take off once held.
  const alwaysActs = (id: string | undefined, row: PageRowView) => id === 'waiting' || id === 'coming' || !!row.struck || !!row.offTonight;
  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));
  const inPlace = (item: Item) => changeable && !!item.row?.acts?.length && !alwaysActs(item.sectionId, item.row);
  const change = (kind: 'swap' | 'takeOff', view: PageRowView, sectionId: string) => setChanging({ kind, view, sectionId: view.listRow?.sectionId ?? sectionId });
  // On the desktop a tapped row on a live list opens its Swap beside the list, Swap pressed under the row; tapped again, or the pane closed, it shuts (Menu-l-desk).
  const shut = () => (setOpen(null), setChanging(null));
  const choose = (item: Item) => (open === item.key ? shut() : (setOpen(item.key), item.row!.drink.kind === 'cocktail' && setPicked(item.row!.drink.id), change('swap', item.row!, item.sectionId!)));

  const rowOf = (item: Item, chosen = sidebar && open === item.key && inPlace(item)) => (chosen ? <DeskChosenRow acts={item.row!.acts!} pressed={changing?.view.drink.id === item.row!.drink.id ? changing.kind : null} name={item.row!.drink.name} onAct={(kind) => (kind === 'swap' || kind === 'takeOff' ? change(kind, item.row!, item.sectionId!) : (acts.act(kind, item.row!, item.sectionId!), shut()))}>{rowView(item, true)}</DeskChosenRow> : rowView(item, false));
  const rowView = (item: Item, chosen: boolean) =>
    item.head ? (
      <View style={styles.sectionHead}>
        <SectionHead name={item.head.name} count={item.head.count} />
      </View>
    ) : item.row ? (
      <MenuPageRow
        row={item.row}
        picked={!chosen && besideId === item.row.drink.id}
        open={bartender || changeable ? open === item.key : undefined}
        chevron={bartender}
        showActs={!chosen && (changeable || (bartender && current)) && (open === item.key || alwaysActs(item.sectionId, item.row))}
        onAct={(kind) => (kind === 'swap' || kind === 'takeOff' ? change(kind, item.row!, item.sectionId!) : acts.act(kind, item.row!, item.sectionId!))}
        // A tap opens the drink (Menu-drink); a bartender's opens the spec in place, and on a live list the team's shows Swap and Take off (Menu-l-swap), each with the way on to the drink (on the desktop the pane is that way for a cocktail; a beer or wine keeps the link).
        onPress={() => (sidebar && inPlace(item) ? choose(item) : bartender || inPlace(item) ? (toggle(item.key), sidebar && item.row!.drink.kind === 'cocktail' && setPicked(item.row!.drink.id)) : openDrink(item.row!.drink))}
      >
        {open !== item.key ? null : bartender ? <MenuSpecInPlace itemId={item.row.drink.id} barId={menu.barId} onOpen={() => openDrink(item.row!.drink)} /> : inPlace(item) && (!sidebar || item.row.drink.kind !== 'cocktail') ? <OpenDrinkLink onOpen={() => openDrink(item.row!.drink)} /> : null}
      </MenuPageRow>
    ) : null;

  const list = (
    <FlatList
      // A menu can run to dozens of drinks: rows mount as they scroll into view. ponytail: the desktop's two columns (Menu-desk) render in the header, not windowed; a menu past ~60 drinks wants a windowed grid.
      data={sidebar ? [] : items}
      keyExtractor={(i) => i.key}
      windowSize={DRAWN_LIST_WINDOW}
      style={styles.screen}
      onScroll={sidebar ? undefined : (e) => setCollapsed(e.nativeEvent.contentOffset.y > COLLAPSE_AT)}
      scrollEventThrottle={32}
      contentContainerStyle={{ paddingBottom: insets.bottom + (draft && team ? 140 : space.xxxl) }}
      renderItem={({ item }) => <View style={column}>{rowOf(item)}</View>}
      ListHeaderComponent={
        <View style={[column, styles.head]}>
          <MenuScreenHead menu={menu} model={model} desk={sidebar} cover={cover} home={lens.lens === 'home'} team={team} draft={draft} past={status === 'previous'} gutter={gutter} top={sidebar ? 0 : insets.top} onBack={back} onShare={share} onEdit={edit} onMore={() => setSheet('more')} pinned={!sidebar} />
          {model.banner ? (
            <MenuPageBanner text={model.banner.text} aside={model.banner.aside} warn={model.banner.warn} onPress={model.banner.toNow && live ? () => go(`/menus/${live.id}`) : undefined} />
          ) : null}
          {/* Only while their own changes wait (Menu-l-ask); a living list draws no group for a bartender. */}
          {acts.may === false && listView.lead?.rows.length ? <MenuPageBanner text="Your changes wait for approval" aside={listView.approvedBy} warn={false} /> : null}
          <MenuPageGroup
            rows={(bartender && livingList
              ? []
              : [
                  ...topRows.slice(0, 1),
                  ...(team && listView.lastChange ? [{ label: 'Last change', value: listView.lastChange, action: null }] : []),
                  ...(team && listView.toldAt ? [{ label: 'Team', value: listView.toldAt, action: null }] : []),
                  ...topRows.slice(1),
                ]
            ).map(withPress)}
          />
          {!drinks.length ? <Body tone="muted">No drinks on this menu yet.</Body> : null}
          {sidebar ? <MenuDeskColumns items={items} render={rowOf} /> : null}
        </View>
      }
      ListFooterComponent={model.after ? <MenuPageAfter note={model.after} style={column} /> : undefined}
    />
  );

  return (
    <View style={[styles.screen, sidebar && styles.split, { backgroundColor: ds.c.ground }]}>
      {list}
      {/* Back stays put on a phone, the page scrolling under it; past the hero the bar takes a backing and the name (Kevin, 3 Nov; #1164). */}
      {sidebar ? null : <View pointerEvents="box-none" style={styles.pinned}><MenuPinnedBar name={menu.name} onBack={back} {...barTools} onMedia={!!cover && ds.scheme === 'dark' && !collapsed} collapsed={collapsed ? { title: menu.name } : null} top={insets.top} gutter={gutter} /></View>}
      {/* The desktop's Swap and Take off open beside the list, over the change log (Menu-l-desk). */}
      {sidebar && changing ? (
        <RowChanges key={`${changing.view.drink.id}-${changing.kind}`} menu={menu} target={changing} ended={listView.ended} acts={acts} onClose={shut} pane={{ after: <ChangeLog menuName={menu.name} changes={listView.changes} /> }} />
      ) : besideId ? (
        <Suspense fallback={null}>
          <MenuDrinkPane drink={drinks.find((d) => d.id === besideId)!} barName={venues.find((v) => v.id === menu.barId)?.name ?? null} place={place} menuId={menu.id} onPick={(id) => { const d = drinks.find((x) => x.id === id); if (d) openDrink(d); }} />
        </Suspense>
      ) : null}
      {draft && team ? (
        <View style={[styles.bottom, (besideId || changing) && sidebar && styles.bottomBeside, { paddingBottom: insets.bottom + space.md, paddingHorizontal: gutter, backgroundColor: ds.c.ground }]}>
          <Button label="Publish" variant="ink" size="lg" onPress={() => setSheet('publish')} style={styles.publish} />
          <Caption tone="muted" align="center">Only your team can see a draft</Caption>
        </View>
      ) : null}
      {changing && !sidebar ? <RowChanges menu={menu} target={changing} ended={listView.ended} acts={acts} onClose={() => setChanging(null)} /> : null}
      {sheet === 'night' ? <HomeNightSheet menu={menu} onClose={() => setSheet(null)} /> : null}
      {sheet === 'share' ? <ShareMenuSheet menu={menu} onClose={() => setSheet(null)} /> : null}
      {sheet === 'more' ? (
        <MenuMoreSheet menu={menu} status={status} visible onClose={() => setSheet(null)} onNight={home ? () => setSheet('night') : undefined} extras={[...(home ? [{ label: 'Edit', onPress: edit }] : []), ...moreExtras(moreRows, menu, actions)]} />
      ) : null}
      {sheet === 'publish' ? <GoLiveSheet visible menu={menu} others={others} onClose={() => setSheet(null)} onDone={() => setSheet(null)} /> : null}
    </View>
  );
}

const COLLAPSE_AT = 200;
const styles = StyleSheet.create({
  screen: { flex: 1 },
  pinned: { position: 'absolute', top: 0, left: 0, right: 0 },
  split: { flexDirection: 'row' },
  missing: { gap: space.lg },
  head: { gap: space.lg, paddingBottom: space.lg },
  sectionHead: { paddingTop: space.xl, paddingBottom: space.sm },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.md, gap: space.sm, alignItems: 'center' },
  bottomBeside: { right: layout.listPaneDesk + 60 },
  publish: { alignSelf: 'stretch' },
});
