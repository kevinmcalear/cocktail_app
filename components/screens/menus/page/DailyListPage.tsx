import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, ExtendedFab, PencilState, Switch, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { Crumbs } from '@/components/nav/PageFrame';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDailyList, useDailyWrites, type DailyRow } from '@/hooks/useDailyList';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMayChangeList } from '@/hooks/useLivingList';
import { useMenuLens } from '@/hooks/useMenuLens';
import { addDays, clockAt, DAILY_AFTER, dailyLead, dayText } from '@/lib/dailyList';
import { isStaffLens } from '@/lib/menuLens';
import { printedPrice } from '@/lib/menus';
import type { MenuDetail } from '@/types/menus';

import { menuDrinkHref } from '../MenuSections';
import { SectionHead } from '../SectionHead';
import { DailyChangesSheet, DailyDaySheet, DailyNoteSheet } from './DailySheets';
import { MenuPageGroup } from './MenuPageGroup';
import { MenuPageHead } from './MenuPageHead';
import { MenuPageRow, type PageRowView } from './MenuPageRow';

type Item = { key: string; head?: { name: string; count: number }; row?: DailyRow; on?: boolean };

/**
 * Tonight, the bar's daily list (decision daily-list; Menu-l-tonight-staff,
 * -tonight, and their dark and Android boards). Whoever is on shift switches
 * drinks on and off on the row, and each switch saves as it goes; the list
 * opens with yesterday's until someone changes it. Below what's on, the
 * drinks on lately wait switched off. Guests read only what's on, with the
 * new ones marked.
 */
export function DailyListPage({ menu }: { menu: MenuDetail }) {
  return (
    <BackbarTheme>
      <DailyBody menu={menu} />
    </BackbarTheme>
  );
}

function DailyBody({ menu }: { menu: MenuDetail }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const sidebar = useIsWideWeb();
  const { venues } = useActiveVenue();
  const lens = useMenuLens(menu).lens;
  const staff = isStaffLens(lens);
  // Anyone on shift writes it (20261205910000), and the menu team.
  const may = useMayChangeList(staff ? menu.id : null).data === true;
  const list = useDailyList(menu);
  const writes = useDailyWrites(menu, list.today);
  const [sheet, setSheet] = useState<'note' | 'day' | 'written' | null>(null);
  // A switch moves at once; the list catches up when the write lands.
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const go = (href: string) => router.push(href as Href);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/menus/all'));
  const time = (iso: string) => clockAt(iso, list.timeZone);

  const flip = (row: DailyRow, on: boolean) => {
    setFlipped((f) => ({ ...f, [row.drink.id]: on }));
    const done = { onSettled: () => setFlipped(({ [row.drink.id]: _, ...rest }) => rest), onError: () => Alert.alert(`${row.drink.name} didn’t ${on ? 'go on' : 'come off'}. Check your connection and try again.`) };
    if (on) writes.switchOn.mutate(row.drink.id, done);
    else if (row.rowId) writes.switchOff.mutate(row.rowId, done);
  };
  const isOn = (row: DailyRow, on: boolean) => flipped[row.drink.id] ?? on;

  const items: Item[] = [
    { key: 'h-on', head: { name: staff ? 'On tonight' : (menu.sections[0]?.name ?? 'Tonight'), count: list.on.length } },
    ...list.on.map((row) => ({ key: `on-${row.drink.id}`, row, on: true })),
    ...(staff && list.off.length ? [{ key: 'h-off', head: { name: 'Not tonight', count: list.off.length } }, ...list.off.map((row) => ({ key: `off-${row.drink.id}`, row, on: false }))] : []),
  ];
  const view = (row: DailyRow, on: boolean): PageRowView => ({
    drink: row.drink,
    line: staff ? row.line : row.drink.line,
    end: staff ? null : printedPrice(row.drink),
    endTone: 'ink',
    sub: null,
    flag: !staff && row.isNew ? { label: 'New', tone: 'green' } : null,
    chips: null,
    talkingPoint: null,
    ink: 'colour',
    faded: !isOn(row, on) || undefined,
  });

  const venue = venues.find((v) => v.id === menu.barId)?.name ?? null;
  const eyebrow = [venue, dayText(list.today)].filter(Boolean).join(' · ');
  const lead = staff ? dailyLead(list.day?.writtenAt ?? null, time) : list.day ? dailyLead(list.day.writtenAt, time) : 'Today’s list';
  const yesterday = addDays(list.today, -1);
  const group = staff
    ? [
        { label: 'Written by', value: list.day ? `${list.writer ?? 'Someone'} · ${time(list.day.writtenAt)}` : 'Nobody yet today', onPress: () => setSheet('written') },
        { label: 'Note for the team', value: list.day?.note ?? (may ? 'Add a note' : 'None today'), onPress: may ? () => setSheet('note') : undefined },
        { label: 'Another day', value: [dayText(yesterday), list.yesterdayCount === null ? null : `${list.yesterdayCount} ${list.yesterdayCount === 1 ? 'drink' : 'drinks'}`].filter(Boolean).join(' · '), onPress: () => setSheet('day') },
      ]
    : [];
  const print = () => go(`/print/list?menu=${menu.id}&print=1`);
  const android = Platform.OS === 'android';
  const column = { paddingHorizontal: gutter, maxWidth: wide ? 760 : undefined, width: '100%', alignSelf: sidebar ? 'flex-start' : 'center' } as const;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={list.failed || list.loading ? [] : items}
        keyExtractor={(i) => i.key}
        windowSize={DRAWN_LIST_WINDOW}
        contentContainerStyle={{ paddingBottom: insets.bottom + (staff ? 150 : space.xxxl) }}
        renderItem={({ item }) => (
          <View style={column}>
            {item.head ? (
              <View style={styles.sectionHead}>
                <SectionHead name={item.head.name} count={item.head.count} />
              </View>
            ) : item.row ? (
              <MenuPageRow
                row={view(item.row, !!item.on)}
                onPress={() => go(`${menuDrinkHref(item.row!.drink)}?menu=${menu.id}`)}
                trailing={staff && may ? <Switch value={isOn(item.row, !!item.on)} label={`${item.row.drink.name} on tonight`} onValueChange={(on) => flip(item.row!, on)} /> : undefined}
              />
            ) : null}
          </View>
        )}
        ListHeaderComponent={
          <View style={[column, styles.head]}>
            {sidebar ? <Crumbs trail={[{ label: 'Menus', href: '/menus/all' }]} /> : null}
            <MenuPageHead
              heroIds={list.on.slice(0, 3).map((r) => r.drink.id)}
              coverUrl={null}
              name={menu.name}
              ink="colour"
              quiet={false}
              tag={staff ? { label: 'Today’s list', tone: 'quiet' } : null}
              eyebrow={eyebrow}
              description={lead}
              onBack={sidebar ? null : back}
              onShare={() => go(`/menus/${menu.id}/card`)}
              pill={null}
              bleed={gutter}
              top={sidebar ? 0 : insets.top}
            />
            <MenuPageGroup rows={group} />
            {list.failed ? (
              <PencilState kind="error" title="Couldn’t load tonight’s list" detail="Check your connection and try again." action={{ label: 'Try again', onPress: list.retry }} />
            ) : list.loading ? (
              <PencilState kind="loading" title="Opening tonight’s list…" />
            ) : !list.on.length && !list.off.length ? (
              <Body tone="muted">No drinks on this list yet. Add them from Edit in More.</Body>
            ) : !list.on.length ? (
              <Body tone="muted">Nothing is on tonight yet. Switch drinks on below.</Body>
            ) : null}
          </View>
        }
        ListFooterComponent={staff ? undefined : <Caption tone="muted" style={[column, styles.after]}>{DAILY_AFTER}</Caption>}
      />
      {staff && android ? <ExtendedFab label="Print tonight’s list" icon="printer" onPress={print} style={{ bottom: insets.bottom + space.lg }} /> : null}
      {staff && !android ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md, paddingHorizontal: gutter, backgroundColor: ds.c.ground }]}>
          <Button label="Print tonight’s list" variant="ink" size="lg" onPress={print} style={[styles.print, { maxWidth: wide ? 520 : undefined }]} />
          {may ? (
            <Caption tone="muted" align="center">
              Each switch saves as you go
            </Caption>
          ) : null}
        </View>
      ) : null}
      {sheet === 'note' ? <DailyNoteSheet note={list.day?.note ?? null} onSave={(n) => writes.note.mutateAsync(n)} onClose={() => setSheet(null)} /> : null}
      {sheet === 'written' ? (
        <DailyChangesSheet
          menu={menu}
          day={list.day}
          today={list.today}
          timeZone={list.timeZone}
          name={list.name}
          drinkName={(id) => [...list.on, ...list.off].find((r) => r.drink.id === id)?.drink.name ?? 'a drink'}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'day' ? <DailyDaySheet menu={menu} today={list.today} start={yesterday} timeZone={list.timeZone} name={list.name} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { gap: space.lg, paddingBottom: space.lg },
  sectionHead: { paddingTop: space.xl, paddingBottom: space.sm },
  after: { paddingTop: space.xl },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.md, gap: space.sm, alignItems: 'center' },
  print: { alignSelf: 'stretch' },
});
