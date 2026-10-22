import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { useItemLocations, useStockedIds } from '@/hooks/useBackBar';
import { useStockToggle } from '@/hooks/useBarStock';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useShelf, useShelfEdit } from '@/hooks/useHomeBar';
import { isShelfBottle } from '@/lib/backBar';
import { withAlpha } from '@/lib/color';
import type { WizardLine } from '@/lib/drinkWizard';

import type { CatalogIngredient } from './IngredientSearch';

/** How long "Del Maguey Vida is on Little Rye's back bar · Undo" stays. */
const NOTE_MS = 10000;

/** Where the bottle on a line puts it: a venue's back bar, or your shelf at home (barId null). */
export interface LineBottlePlace {
  barId: string | null;
  venueName: string;
}

type Look = 'on' | 'off' | 'locked';

/** The bottle drawn on the board (eddie-oct22-wave2, fix 12): gold and filled when it's there, a quiet outline when not. */
function BottleIcon({ look, on }: { look: Look; on: boolean }) {
  const ds = useDs();
  const tone = look === 'locked' ? ds.c.muted : ds.accentText;
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill={on ? withAlpha(tone, look === 'locked' ? 0.3 : 0.35) : 'none'}
      stroke={look === 'off' ? ds.c.faint : tone}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <Path d="M10 2.5h4v4l1.6 2.6V20a1.6 1.6 0 0 1-1.6 1.6h-4A1.6 1.6 0 0 1 8.4 20V9.1L10 6.5z" />
      <Path d="M8.4 13h7.2" />
    </Svg>
  );
}

interface BottlesProps {
  place: LineBottlePlace;
  /** The drink's name, kept with the bottle: "Added from Ash Garden". */
  drinkName: string;
  ingredients: readonly CatalogIngredient[];
  /** The lines; each draws its own with LineBottle. */
  children: ReactNode;
}

/**
 * The quiet bottle at the end of each spec line: lit when it's on the
 * venue's back bar (or your shelf at home), one tap to switch, and a short
 * note with Undo. Never a question. Bottles only: juice, garnish, water and
 * house preps get none. Roles that can't place items on the back bar see it
 * but can't switch it. Without a place (an ingredient's own recipe) the lines
 * have none.
 */
export function LineBottles({ place, ...rest }: Omit<BottlesProps, 'place'> & { place: LineBottlePlace | undefined }) {
  return place ? <Bottles place={place} {...rest} /> : rest.children;
}

const BottleContext = createContext<((line: WizardLine) => ReactNode) | null>(null);

/** A line's bottle, inside LineBottles. */
export function LineBottle({ line }: { line: WizardLine }) {
  return use(BottleContext)?.(line) ?? null;
}

function Bottles({ place, drinkName, ingredients, children }: BottlesProps) {
  const ds = useDs();
  const barId = place.barId;
  const home = !barId;
  const stocked = useStockedIds(barId);
  const spots = useItemLocations(barId).data;
  const caps = useCapabilities(barId).data;
  const toggle = useStockToggle(barId);
  const shelf = useShelf().data;
  const shelfEdit = useShelfEdit();
  const [note, setNote] = useState<{ text: string; undo?: () => void } | null>(null);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(t);
  }, [note]);

  const have = home ? new Set(shelf ?? []) : stocked;
  // Mirrors bar_stock's policies: placing items on the back bar (edit_drinks, or a role with prep).
  const canChange = home || (Array.isArray(caps) && (caps.includes('edit_drinks') || caps.includes('prep')));
  const where = home ? 'your shelf' : `${place.venueName}’s back bar`;

  const set = (item: { id: string; name: string }, on: boolean, undoable = true) => {
    if (home) (on ? shelfEdit.add : shelfEdit.remove).mutate(item.id);
    else toggle.mutate({ item, on, from: drinkName.trim() || null });
    const text = on ? `${item.name} is on ${where}` : `Took ${item.name} off ${where}`;
    setNote({ text, undo: undoable ? () => set(item, !on, false) : undefined });
  };

  const bottle = (line: WizardLine): ReactNode => {
    const row = line.id && !line.prep && !line.later && !line.technique ? ingredients.find((i) => i.id === line.id) : null;
    const generic = row?.generic_id ? (ingredients.find((i) => i.id === row.generic_id)?.name ?? null) : null;
    // A blank the bottle's size keeps the amounts in line down the list.
    if (!row || !isShelfBottle(row, generic)) return <View style={styles.button} />;
    const item = { id: row.id, name: line.name };
    const on = have.has(item.id);
    // A bottle with a spot comes off from the back bar plan, where its spot, par and container are.
    const placed = !home && on && !!spots?.some((s) => s.item_id === item.id);
    const label = !canChange
      ? `${item.name} is ${on ? '' : 'not '}on the back bar. Your role can’t change it`
      : on
        ? `${item.name} is on ${where}`
        : `${item.name} is not on ${home ? 'your shelf' : 'the back bar'}. Add it`;
    return (
      <PressableScale
        onPress={() => (placed ? setNote({ text: `${item.name} has a spot on the back bar plan. Take it off there.` }) : set(item, !on))}
        disabled={!canChange}
        role="button"
        aria-pressed={on}
        accessibilityLabel={label}
        style={styles.button}
      >
        <BottleIcon look={canChange ? (on ? 'on' : 'off') : 'locked'} on={on} />
      </PressableScale>
    );
  };

  return (
    <BottleContext value={bottle}>
      {children}
      {note ? (
        <View role="status" style={[styles.note, { backgroundColor: ds.c.raised }]}>
          <Body style={styles.flex} numberOfLines={2}>
            {note.text}
          </Body>
          {note.undo ? <Button label="Undo" variant="ghost" onPress={note.undo} accessibilityLabel={`Undo: ${note.text}`} /> : null}
        </View>
      ) : null}
      <Caption tone="muted">{`The bottle on the right: lit when it’s on ${home ? 'your shelf' : 'your back bar'}. Tap to change.`}</Caption>
    </BottleContext>
  );
}

const styles = StyleSheet.create({
  button: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, borderRadius: radius.control, paddingLeft: space.lg, paddingRight: space.xs },
  flex: { flex: 1 },
});
