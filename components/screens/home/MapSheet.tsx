import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import type { BottomSheetHandleProps } from '@gorhom/bottom-sheet';

import { Caption, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { DiscoverDrink } from '@/lib/discoverDrinks';

import { SheetLine, useMapSheetChrome, usePageFade } from './mapSheetChrome';

/** Until the handle measures itself: the grabber and the title's row. */
const HANDLE = 66;
/** How far a tapped bar's card opens the sheet. */
const BAR_STOP = '55%';

interface MapSheetProps {
  sheetRef: RefObject<BottomSheet | null>;
  /** The sheet's position and index, shared with Find me (useFindMe's `sheet`). */
  animated: { animatedPosition: SharedValue<number>; animatedIndex: SharedValue<number> };
  /** Find me, riding the sheet; `full` is the top stop's index. */
  findMe: (full: number) => ReactNode;
  /** Room for the screen's header: the sheet tops out under it. */
  topInset: number;
  /** The sheet at rest is this tall, for the map's camera. */
  onPeek: (peek: number) => void;
  title: string;
  /** "229 bars", "31 at 24 bars". */
  count: string;
  /** Under the page's title: the order, the classic line. */
  below?: ReactNode;
  /** A tapped bar's card: the sheet stops partway to fit it, and the card leads in place of the title. `barId` keys it. */
  bar?: { id: string; card: ReactNode } | null;
  /** Nothing picked: the shelves, then `listTitle` over the rows. */
  browse?: ReactNode;
  listTitle?: string;
  drinks: readonly DiscoverDrink[];
  renderItem: (drink: DiscoverDrink, index: number) => ReactNode;
  extraData?: unknown;
  /** When there are no rows: loading, a note, the top bars. */
  empty?: ReactNode;
  footer: ReactNode;
  onEndReached?: () => void;
}

const drinkKey = (d: DiscoverDrink) => d.id;

/**
 * The phone map's results (disc-map-sheet, approved 24 Oct), as Google Maps
 * has them: docked on the tab bar, one line at rest. Swiped up it covers the
 * map (no Map button; swiping down is the way back) and the line gives way to
 * the page's display title. It stops partway only for a tapped bar.
 */
export function MapSheet({ sheetRef, animated, findMe, topInset, onPeek, title, count, below, bar, browse, listTitle, drinks, renderItem, extraData, empty, footer, onEndReached }: MapSheetProps) {
  const chrome = useMapSheetChrome();
  const [handle, setHandle] = useState(HANDLE);
  const peek = handle + chrome.foot;
  useEffect(() => onPeek(peek), [peek, onPeek]);
  const snapPoints = bar ? [peek, BAR_STOP, '100%'] : [peek, '100%'];
  const full = snapPoints.length - 1;
  // A tapped bar opens the sheet to its card; closing it goes back to the line, the map in view.
  const barId = bar?.id ?? null;
  const last = useRef(barId);
  useEffect(() => {
    if (last.current === barId) return;
    last.current = barId;
    sheetRef.current?.snapToIndex(barId ? 1 : 0);
  }, [barId, sheetRef]);
  const page = usePageFade(animated.animatedIndex);
  // One component for the life of the sheet's contents: a new one each render would remount the handle.
  const line = useCallback(
    ({ animatedIndex }: BottomSheetHandleProps) => <SheetLine animatedIndex={animatedIndex} title={barId ? null : title} count={count} onOpen={() => sheetRef.current?.snapToIndex(full)} onMeasure={setHandle} />,
    [title, count, full, sheetRef, barId]
  );
  return (
    <View pointerEvents="box-none" style={[chrome.box, { top: topInset }]}>
      {findMe(full)}
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        {...chrome.sheet}
        {...animated}
        handleComponent={line}
        accessibilityLabel="Results"
      >
        <Animated.View style={[styles.page, page]}>
          {/* A virtualized list: "anywhere" can load hundreds of drinks, and only the ones on screen are drawn. */}
          <BottomSheetFlatList
            data={drinks}
            keyExtractor={drinkKey}
            renderItem={({ item, index }: { item: DiscoverDrink; index: number }) => <>{renderItem(item, index)}</>}
            extraData={extraData}
            contentContainerStyle={[styles.list, { paddingBottom: chrome.foot + space.lg }]}
            ListHeaderComponent={
              <View style={styles.head}>
                {bar ? (
                  bar.card
                ) : (
                  // The title is the handle's, pinned above the list.
                  <View style={styles.titled}>
                    {count ? <Caption tone="muted">{count}</Caption> : null}
                    {below}
                  </View>
                )}
                {browse}
                {listTitle && drinks.length ? <Headline role="heading">{listTitle}</Headline> : null}
              </View>
            }
            // In a View: the list measures its empty state, and some of these are fragments.
            ListEmptyComponent={empty ? <View style={styles.empty}>{empty}</View> : undefined}
            ListFooterComponent={<View style={styles.foot}>{footer}</View>}
            // The next page as the list nears its end ("load more as you scroll").
            onEndReached={onEndReached}
            onEndReachedThreshold={1.5}
            // The sheet shows a screenful of rows; draw a few more, then the rest as it scrolls.
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={7}
          />
        </Animated.View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  list: { paddingHorizontal: space.lg },
  head: { gap: space.xl, paddingBottom: space.sm },
  titled: { gap: space.md },
  empty: { gap: space.md },
  foot: { gap: space.md, paddingTop: space.md },
});
