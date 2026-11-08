import * as Haptics from 'expo-haptics';
import { createContext, use, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { layout, lift as LIFT, radius, space } from '@/constants/tokens';
import { dragSlot, dropIndex, gapShift, slotOffset } from '@/lib/dropIndex';

import { DragRow, GRIP_SLOP } from './DragRow';
import { PressableScale } from './PressableScale';
import { useDs } from './theme';

const web = Platform.OS === 'web';
// react-native-web writes dataSet as data-* attributes; React Native's types don't know it.
const GRIP_DATA = { dataSet: { dragGrip: '' } } as object;

export interface DragRowState {
  index: number;
  /** Being dragged. */
  lifted: boolean;
  /** Wraps the row's grip (DragGrip): hold it and drag. */
  grip: (node: ReactNode) => ReactNode;
  /** One place up or down: the grip's arrow keys and a screen reader's actions. */
  move: (by: -1 | 1) => void;
}

/**
 * A list you reorder by dragging (Add-drag): each row's grip (DragGrip) picks
 * it up after a short hold on a touch screen (at once with a mouse); the
 * others ease aside to show where it lands; near the edge of the
 * DragScrollView around it the page scrolls; let go, it eases into its slot
 * and `onReorder` has the new order. The arrow keys on a focused grip, and a
 * screen reader's Move up and Move down, move a row one place. A `still` row
 * (a line between rows) slides aside but never lifts. A move `accept` turns
 * down (one that changes nothing that's saved) shows no gap, and the row goes
 * back to its place. Every row is rendered,
 * so it suits a page's list (a few hundred rows at most), not an endless feed.
 */
export function DragList<T>({ data, keyOf, onReorder, accept, renderRow, still, label, axis = 'y', card = true, style }: { data: readonly T[]; keyOf: (item: T) => string; onReorder: (next: T[], from: number, to: number) => void; accept?: (next: T[]) => boolean; renderRow: (item: T, row: DragRowState) => ReactNode; still?: (item: T) => boolean; label?: string; axis?: 'x' | 'y'; /** Off when the row draws its own lifted look (a photo). */ card?: boolean; style?: StyleProp<ViewStyle> }) {
  // Each row's size, by its key: where a dragged one lands.
  const sizes = useRef<Record<string, number>>({});
  // The held row, where its gap is, how tall, and how far its slot is from its place.
  const [held, setHeld] = useState<{ from: number; slot: number; gap: number; land: number } | null>(null);
  // The same, read between renders: a drag reports every frame.
  const heldRef = useRef(held);
  const all = () => data.map((item) => sizes.current[keyOf(item)] ?? 0);
  const moved = (from: number, to: number) => {
    const next = [...data];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  const put = (from: number, to: number) => {
    if (to < 0 || to >= data.length || to === from || still?.(data[from])) return;
    onReorder(moved(from, to), from, to);
  };
  const onMove = (from: number, d: number) => {
    const was = heldRef.current;
    const rows = all();
    // Nothing combines here, so a row slides once the held one's middle passes its own.
    const at = dragSlot(from, d, rows, was?.from === from ? was.slot : from, 1 / 2).slot;
    const slot = accept && at !== from && !accept(moved(from, at)) ? from : at;
    if (was?.from === from && was.slot === slot) return was.land;
    // A tick as a row slides aside, as iOS lists do.
    if (was && !web) void Haptics.selectionAsync();
    heldRef.current = { from, slot, gap: rows[from] ?? 0, land: slotOffset(from, slot, rows) };
    setHeld(heldRef.current);
    return heldRef.current.land;
  };
  const onDrop = (from: number, d: number) => {
    const to = heldRef.current?.from === from ? heldRef.current.slot : dropIndex(from, d, all());
    heldRef.current = null;
    setHeld(null);
    put(from, to);
  };
  return (
    <Announcer>
      <View role="list" aria-label={label} style={[axis === 'x' && styles.across, style]}>
        {data.map((item, i) => {
          const key = keyOf(item);
          const fixed = !!still?.(item);
          return (
            <DragRow
              key={key}
              index={i}
              axis={axis}
              card={card}
              shift={held ? gapShift(i, held.from, held.slot, held.gap) : null}
              onMove={fixed ? undefined : onMove}
              onCancel={(from) => easeBack(heldRef, setHeld, from)}
              onDrop={fixed ? () => {} : onDrop}
              onHeight={(h) => void (sizes.current[key] = h)}
            >
              {(grip, lifted) => renderRow(item, { index: i, lifted, grip: fixed ? (node) => node : grip, move: (by) => put(i, i + by) })}
            </DragRow>
          );
        })}
      </View>
    </Announcer>
  );
}

/**
 * A drag taken away before it was let go (DragRow's onCancel): the rows ease
 * back to their places, then the list forgets it. For DragList and the spec's
 * useCombineDrop, which keep the held row the same way.
 */
export function easeBack<H extends { from: number; slot: number; land: number }>(ref: { current: H | null }, set: (held: H | null) => void, from: number) {
  const was = ref.current;
  if (was?.from !== from) return;
  const rest = { ...was, slot: from, land: 0 };
  ref.current = rest;
  set(rest);
  setTimeout(() => {
    // Unless another row was picked up meanwhile.
    if (ref.current !== rest) return;
    ref.current = null;
    set(null);
  }, LIFT.ms.slide);
}

const AnnounceContext = createContext<((text: string) => void) | null>(null);

/**
 * Where a grip says what it did ("Paloma moved up"): a live region on the web,
 * the screen reader's announcement on a phone.
 */
export function Announcer({ children }: { children: ReactNode }) {
  const [said, setSaid] = useState('');
  if (!web) return children;
  return (
    <AnnounceContext value={setSaid}>
      {children}
      <Text aria-live="polite" style={styles.hidden}>
        {said}
      </Text>
    </AnnounceContext>
  );
}

const useAnnounce = () => use(AnnounceContext) ?? ((text: string) => AccessibilityInfo.announceForAccessibility(text));

/**
 * The one grip (Kevin, 4 Nov): six dots on the left of the row, drawn narrow
 * and held 44 wide (GRIP_SLOP). On the web it's grabbed with the mouse, and
 * focused, the arrow keys move its row, or Space picks it up and puts it
 * down; a screen reader gets Move up and Move down. `onPress` (a tap) is the
 * row's own: the staff list opens its buttons. `children` sit after the
 * dots (a step's number).
 */
export function DragGrip({ name, onMove, onPress, label, hint, lifted, expanded, children, style }: { name: string; onMove?: (by: -1 | 1) => void; onPress?: () => void; label?: string; hint?: string; lifted?: boolean; expanded?: boolean; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const announce = useAnnounce();
  const [picked, setPicked] = useState(false);
  const step = (by: -1 | 1) => {
    if (!onMove) return;
    onMove(by);
    announce(`${name} moved ${by < 0 ? 'up' : 'down'}`);
  };
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      return step(e.key === 'ArrowUp' ? -1 : 1);
    }
    if (e.key === ' ' || (e.key === 'Escape' && picked)) {
      e.preventDefault();
      const now = e.key === ' ' && !picked;
      setPicked(now);
      announce(now ? `${name} picked up. The arrow keys move it, Space puts it down.` : `${name} put down.`);
    }
  };
  return (
    <PressableScale
      role="button"
      accessibilityLabel={label ?? `Reorder ${name}`}
      accessibilityHint={hint ?? (web ? 'Drag, or use the arrow keys' : 'Hold and drag')}
      aria-expanded={expanded}
      accessibilityActions={onMove ? [{ name: 'moveUp', label: 'Move up' }, { name: 'moveDown', label: 'Move down' }] : undefined}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
      // @ts-expect-error onKeyDown and onBlur's web events are react-native-web's
      onKeyDown={onKeyDown}
      onBlur={() => setPicked(false)}
      onPress={onPress}
      hitSlop={{ left: GRIP_SLOP, right: GRIP_SLOP }}
      // The page's buttons show a pointer (app/_layout.tsx); a grip shows a hand that grabs.
      {...GRIP_DATA}
      haptic={false}
      style={[styles.grip, web && (lifted ? styles.grabbing : styles.grab), style]}
    >
      <GripDots />
      {children}
    </PressableScale>
  );
}

/** A grip's six dots. */
export function GripDots() {
  const ds = useDs();
  return (
    <View style={styles.dots}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.dot, { backgroundColor: ds.c.muted }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  across: { flexDirection: 'row' },
  // Narrow, so the row keeps its room on a phone; the hold, not its size, keeps a swipe over it scrolling.
  grip: { minWidth: space.xl, height: layout.minTapTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, marginRight: -space.xs },
  // On a grip only, so a finger anywhere else still scrolls the page.
  grab: { cursor: 'grab', touchAction: 'none' } as object,
  grabbing: { cursor: 'grabbing', touchAction: 'none' } as object,
  dots: { width: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  dot: { width: 2.5, height: 2.5, borderRadius: radius.pill },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', left: -10000 },
});
