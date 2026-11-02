import { useIsFocused, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { Crumbs } from '@/components/nav/PageFrame';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { menuCover, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useOffTonight } from '@/hooks/useListAsks';
import { useEndedRuns, useListChanges } from '@/hooks/useLivingList';
import { useMenuLens } from '@/hooks/useMenuLens';
import { useEndMenu } from '@/hooks/useMenuMutations';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { useMyBar } from '@/hooks/useHomeBar';
import { usePhotoTone } from '@/hooks/usePhotoTone';
import { useShoppingEdit } from '@/hooks/useShoppingList';
import { confirmAsync } from '@/lib/dialogs';
import { isLivingList } from '@/lib/menuLens';
import { isOneNightMenu, menuStatus, newDrinkIds } from '@/lib/menus';
import { menuShopping } from '@/lib/shoppingList';
import type { ShelfMatch } from '@/lib/shelfReach';
import type { MenuDetail } from '@/types/menus';

import { GoLiveSheet } from './GoLiveSheet';
import { HomeNightSheet } from './HomeNight';
import { menuDrinkHref } from './MenuSections';
import { SectionHead } from './SectionHead';
import { MenuMoreSheet } from './MenuMoreSheet';
import { ShareMenuSheet } from './ShareMenuSheet';
import { DailyListPage } from './page/DailyListPage';
import { MenuPageBanner, MenuPageGroup } from './page/MenuPageGroup';
import { MenuPageHead } from './page/MenuPageHead';
import { MenuPageRow, type PageRowView } from './page/MenuPageRow';
import { menuPageModel, type GroupAction } from './page/menuPageModel';
import { MenuSpecInPlace } from './page/MenuSpecInPlace';
import { RowChanges, useRowActs, type ChangeTarget } from './page/RowChanges';
import { useLiveSections } from './page/useLiveSections';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

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
  // Only a home menu reads your shelf (Ready, Need limes, the shopping list).
  return menu.barId ? <MenuPage menu={menu} shelf={null} /> : <HomeMenuPage menu={menu} />;
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

/**
 * A bar's menu that's on or coming up leads with its cover photo when it has
 * one, and the photo decides light or dark for the whole page (Menu-g-photo-dark,
 * Menu-g-photo-bright). Drafts, past menus and home menus are drawn.
 */
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
  const [sheet, setSheet] = useState<'more' | 'night' | 'share' | 'publish' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [changing, setChanging] = useState<ChangeTarget | null>(null);
  const lens = useMenuLens(menu);
  const hide = useListChanges(menu.id).hide;
  // Only drinks that left after it went on: edits to a draft don't make it a living list.
  const ended = useEndedRuns(lens.lens === 'creator' || lens.lens === 'admin' ? menu.id : null).data ?? [];
  const endedRuns = menu.startsAt ? ended.filter((r) => Date.parse(r.cameOff) > Date.parse(menu.startsAt!)).length : 0;
  const end = useEndMenu();
  const { data: venueMenus = [] } = useVenueMenus(menu.barId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/menus/all'));

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
  const go = (href: string) => router.push(href as Href);
  // A drink opens in its menu: the drink page shows "Autumn · 4 of 8" and pages through it.
  const openDrink = (row: PageRowView) => go(`${menuDrinkHref(row.drink)}?menu=${menu.id}`);
  const failed = (message: string) => Alert.alert(message);
  const endMenu = async () => {
    // A list still to come has nothing to end: it goes back to being a draft (as in More).
    const ok = await confirmAsync(
      status === 'upcoming'
        ? { title: `Unschedule ${menu.name}?`, message: 'It goes back to being a draft.', confirmText: 'Unschedule' }
        : { title: `End ${menu.name}?`, message: 'It moves to Past. You can put it on again later.', confirmText: 'End it' },
    );
    if (!ok) return;
    try {
      await end.mutateAsync(menu.id);
    } catch {
      failed('That didn’t work. Try again.');
    }
  };
  const share = () => (lens.lens === 'home' || isOneNightMenu(menu) ? setSheet('share') : go(`/menus/${menu.id}/card`));

  const actions: Record<Exclude<GroupAction, null>, () => void> = {
    dates: () => setSheet('more'),
    end: () => void endMenu(),
    barPage: () => hide.mutate(!menu.hiddenAt, { onError: () => failed('That didn’t work. Try again.') }),
    costing: () => go(`/menus/${menu.id}/costing`),
    runSheet: () => go(`/menus/${menu.id}/run-sheet`),
    prep: () => go('/prep'),
    offMenu: () => go('/off-menu'),
    publish: () => setSheet('publish'),
    replaces: () => (live ? go(`/menus/${live.id}`) : undefined),
    night: () => setSheet('night'),
    shopping: () => shelf?.toShopping(),
  };

  // A list that's on, or coming up: its drinks change one at a time, on the row (Menu-l-swap); a bartender asks (Menu-l-ask).
  const bartender = lens.lens === 'bartender';
  const current = !!menu.barId && (status === 'on' || status === 'upcoming');
  const changeable = team && current;
  const living = changeable && isLivingList(lens.rows, menu.startsAt, endedRuns);
  const acts = useRowActs(menu, lens.rows, bartender);
  const listView = useLiveSections({ menu, sections: model.sections, rows: lens.rows, may: acts.may ?? false, on: changeable || (bartender && current), bartender, living, now });
  const shown = [...(listView.lead ? [listView.lead] : []), ...listView.main, ...(listView.coming ? [listView.coming] : [])];
  const items: Item[] = shown.flatMap((s) => [
    { key: `h-${s.id}`, head: { name: s.name, count: s.rows.filter((r) => !r.struck).length } },
    // A drink can be in two asks, or an ask and a waiting row: the ask keys it.
    ...s.rows.map((row) => ({ key: `${s.id}-${row.ask ? `${row.ask.id}-` : ''}${row.drink.id}${row.struck ? '-off' : ''}`, row, sectionId: s.id })),
  ]);
  const column = { paddingHorizontal: gutter, maxWidth: wide ? menuCover.column : undefined, width: '100%', alignSelf: sidebar ? 'flex-start' : 'center' } as const;
  // Waiting changes, Undo, Back on and Coming up show their buttons; any other row shows Swap and Take off once tapped.
  const alwaysActs = (id: string | undefined, row: PageRowView) => id === 'waiting' || id === 'coming' || !!row.struck || !!row.offTonight;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        // A menu can run to dozens of drinks: rows mount as they scroll into view.
        data={items}
        keyExtractor={(i) => i.key}
        windowSize={DRAWN_LIST_WINDOW}
        contentContainerStyle={{ paddingBottom: insets.bottom + (draft && team ? 140 : space.xxxl) }}
        renderItem={({ item }) => (
          <View style={column}>
            {item.head ? (
              <View style={styles.sectionHead}>
                <SectionHead name={item.head.name} count={item.head.count} />
              </View>
            ) : item.row ? (
              <MenuPageRow
                row={item.row}
                open={bartender || changeable ? open === item.key : undefined}
                chevron={bartender}
                showActs={(changeable || (bartender && current)) && (open === item.key || alwaysActs(item.sectionId, item.row))}
                onAct={(kind) =>
                  kind === 'swap' || kind === 'takeOff'
                    ? setChanging({ kind, view: item.row!, sectionId: item.row!.listRow?.sectionId ?? item.sectionId! })
                    : acts.act(kind, item.row!, item.sectionId!)
                }
                onPress={() =>
                  bartender || (changeable && item.row!.acts?.length && !alwaysActs(item.sectionId, item.row!)) ? setOpen((o) => (o === item.key ? null : item.key)) : openDrink(item.row!)
                }
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
              coverUrl={cover}
              name={menu.name}
              ink={model.ink}
              quiet={model.quiet}
              tag={model.tag}
              eyebrow={model.eyebrow}
              description={menu.description}
              onBack={sidebar ? null : back}
              onShare={lens.lens === 'home' ? null : share}
              // Edit is the one action for the menu team; a draft's is Publish and a home menu's Share, so theirs is a glass pencil.
              onEdit={(team && draft) || lens.lens === 'home' ? () => go(`/menus/${menu.id}/edit`) : null}
              pill={lens.lens === 'home' ? { label: 'Share', onPress: share } : team && !draft && status !== 'previous' && !living ? { label: 'Edit', onPress: () => go(`/menus/${menu.id}/edit`) } : null}
              bleed={gutter}
              top={sidebar ? 0 : insets.top}
            />
            {model.banner ? (
              <MenuPageBanner text={model.banner.text} aside={model.banner.aside} warn={model.banner.warn} onPress={model.banner.toNow && live ? () => go(`/menus/${live.id}`) : undefined} />
            ) : null}
            {acts.may === false && (changeable || (bartender && current)) ? <MenuPageBanner text="Your changes wait for approval" aside={listView.approvedBy} warn={false} /> : null}
            <MenuPageGroup
              rows={[
                ...model.group.slice(0, 1),
                ...(listView.lastChange ? [{ label: 'Last change', value: listView.lastChange, action: null }] : []),
                ...(listView.toldAt ? [{ label: 'Team', value: listView.toldAt, action: null }] : []),
                ...model.group.slice(1),
              ].map((r) => ({ ...r, onPress: r.action ? actions[r.action] : undefined }))}
            />
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
      {changing ? <RowChanges menu={menu} target={changing} ended={listView.ended} acts={acts} onClose={() => setChanging(null)} /> : null}
      {sheet === 'night' ? <HomeNightSheet menu={menu} onClose={() => setSheet(null)} /> : null}
      {sheet === 'share' ? <ShareMenuSheet menu={menu} onClose={() => setSheet(null)} /> : null}
      {sheet === 'more' ? <MenuMoreSheet menu={menu} status={status} visible onClose={() => setSheet(null)} onNight={home ? () => setSheet('night') : undefined} onEdit={living ? () => go(`/menus/${menu.id}/edit`) : undefined} /> : null}
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
