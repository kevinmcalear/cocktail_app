import { useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { space } from '@/constants/tokens';
import type { MenuLensData } from '@/hooks/useMenuLens';
import type { MenuDetail } from '@/types/menus';

import { SectionHead } from '../SectionHead';
import { MenuPageBanner } from './MenuPageGroup';
import { MenuPageHead } from './MenuPageHead';
import { MenuPageRow, type PageRowView } from './MenuPageRow';
import { menuPageModel, type MenuPageModel } from './menuPageModel';
import { dayMonth } from '@/lib/dayMonth';

type Item = { key: string; head?: { name: string; count: number }; row?: PageRowView };

const COLUMN = 760;

const day = (iso: string) => dayMonth(new Date(iso), { weekday: 'short', month: 'short' });

/**
 * A menu for someone with no job at the bar: a guest on a bar's public link,
 * signed out or not (Menu-who-guest, Menu-g-*, Menu-p-page), or a friend on a
 * shared home menu (Menu-h-friend). The menu page's head, banner and rows,
 * with nothing to change: `MenuScreen` is the same page with the staff's
 * layers on it.
 */
export function GuestMenuPage({
  menu,
  lens,
  status,
  eyebrow,
  onNow,
  onToNow,
  onBack,
  onShare,
  label,
  rowPress,
  after,
  description,
  fresh,
  under,
  footer,
  offTonight,
}: {
  menu: MenuDetail;
  /** What the person looking adds (their allergies); a friend's menu has none. */
  lens: MenuLensData;
  status: 'on' | 'previous';
  eyebrow: string;
  /** The bar's menu on now: a past menu's "On now" marks and its What's on now link. */
  onNow?: { name: string; itemIds: Set<string> } | null;
  onToNow?: () => void;
  onBack: (() => void) | null;
  onShare: (() => void) | null;
  /** In Back's place on a page with no way back (Menu-h-friend's "Cocktail"). */
  label?: { text: string; onPress: () => void };
  /** Where a drink's row goes; null keeps it a plain row (a drink kept private). */
  rowPress: (row: PageRowView) => (() => void) | null;
  /** The page's closing note, in place of the model's. */
  after?: string;
  /** The line under the name, in place of the menu's own (a daily list's "Today’s list, written at 4:10pm"). */
  description?: string;
  /** Drinks marked New (a daily list's drinks on for the first time tonight). */
  fresh?: ReadonlySet<string>;
  /** Under the name, above the drinks. */
  under?: ReactNode;
  footer?: ReactNode;
  /** Drinks off for tonight only: "Not tonight". */
  offTonight?: ReadonlySet<string>;
}) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { width } = useWindowDimensions();
  const [now] = useState(() => Date.now());
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const model: MenuPageModel = menuPageModel({
    menu,
    status,
    lens,
    venueName: null,
    onNow: onNow ? { ...onNow, endsAt: null } : null,
    newIds: undefined,
    shelf: null,
    toBuy: null,
    day,
    now,
    offTonight,
  });
  const items: Item[] = model.sections.flatMap((s) => [
    { key: `h-${s.id}`, head: { name: s.name, count: s.rows.length } },
    ...s.rows.map((row, i) => ({ key: `${s.id}-${row.drink.id}-${i}`, row: fresh?.has(row.drink.id) && !row.flag ? { ...row, flag: { label: 'New', tone: 'green' as const } } : row })),
  ]);
  // The drinks the reader can open: one kept to the team has no drawing they can read.
  const hero = model.sections.flatMap((s) => s.rows).filter((row) => rowPress(row)).slice(0, 3).map((row) => row.drink.id);
  const column = { paddingHorizontal: gutter, maxWidth: wide ? COLUMN : undefined, width: '100%', alignSelf: 'center' } as const;
  const closing = after ?? model.after;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        windowSize={DRAWN_LIST_WINDOW}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
        renderItem={({ item }) => (
          <View style={column}>
            {item.head ? (
              <View style={styles.sectionHead}>
                <SectionHead name={item.head.name} count={item.head.count} />
              </View>
            ) : item.row ? (
              <MenuPageRow row={item.row} onPress={rowPress(item.row) ?? undefined} />
            ) : null}
          </View>
        )}
        ListHeaderComponent={
          <View style={[column, styles.head]}>
            <MenuPageHead
              heroIds={hero}
              coverUrl={menu.coverUrl}
              name={menu.name}
              ink={model.ink}
              quiet={model.quiet}
              tag={model.tag}
              eyebrow={eyebrow}
              description={description ?? menu.description}
              onBack={onBack}
              onShare={onShare}
              label={label}
              bleed={wide ? Math.max(gutter, (width - COLUMN) / 2 + gutter) : gutter}
              top={insets.top}
            />
            {model.banner ? <MenuPageBanner text={model.banner.text} aside={model.banner.aside} warn={model.banner.warn} onPress={model.banner.toNow ? onToNow : undefined} /> : null}
            {under}
            {!drinks.length ? <Body tone="muted">The drinks on this menu aren’t listed yet.</Body> : null}
          </View>
        }
        ListFooterComponent={
          <View style={[column, styles.foot]}>
            {closing ? <Caption tone="muted">{closing}</Caption> : null}
            {footer}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { gap: space.lg, paddingBottom: space.lg },
  sectionHead: { paddingTop: space.xl, paddingBottom: space.sm },
  foot: { paddingTop: space.xl, gap: space.lg },
});
