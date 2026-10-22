import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { useBackBarParts, useStockMutations, type BackBarReason } from '@/hooks/useBackBar';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useExpiring } from '@/hooks/useExpiring';
import { useShelf, useShelfEdit } from '@/hooks/useHomeBar';
import { pressedProps } from '@/lib/a11yState';
import { isStockable } from '@/lib/backBar';
import { withAlpha } from '@/lib/color';
import type { WizardLine } from '@/lib/drinkWizard';

import type { CatalogIngredient } from './IngredientSearch';

/** How long "… is on Little Rye's back bar · Undo" stays. */
const NOTE_MS = 10000;

/** Each line's bottle, and what goes under the lines. From useLineStock. */
export interface LineStock {
  /** The bottle button for a line, or null for juice, garnish, water, a house prep or a batch. */
  toggle: (line: WizardLine) => ReactNode;
  /** Under the lines: the hint, then the note with Undo after a tap. */
  footer: ReactNode;
}

interface Note {
  text: string;
  undo?: () => void;
}

// A bottle that's on the back bar anyway: the tap says why instead of switching it off.
const STAYS: Record<BackBarReason, (name: string, place: string) => string> = {
  own: (name, place) => `${name} is ${place}’s own, so it stays on the back bar`,
  spot: (name, place) => `${name} has a spot on ${place}’s back bar plan, so it stays on`,
  pour: (name, place) => `Another drink at ${place} pours ${name}, so it stays on the back bar`,
};

interface LineStockOptions {
  /** The venue; null at home, where the bottle means your shelf. */
  barId: string | null;
  venueName: string;
  /** The drink being added: "Added from Ash Garden" on the back bar plan. */
  drinkName: string;
  ingredients: readonly CatalogIngredient[];
  lines: readonly WizardLine[];
}

/**
 * The bottle on each line (board fix 12): lit when it's on the venue's back
 * bar, or on your shelf at home. One tap switches it and a short note says
 * so, with Undo. Never a question or a step. People whose role can't place
 * items see the state, but it doesn't switch.
 */
export function useLineStock({ barId, venueName, drinkName, ingredients, lines }: LineStockOptions): LineStock {
  const ds = useDs();
  const [note, setNote] = useExpiring<Note>(NOTE_MS);

  const { fixed, stocked } = useBackBarParts(barId, ingredients);
  const caps = useCapabilities(barId).data;
  const stock = useStockMutations(barId);
  const shelf = useShelf().data;
  const shelfEdit = useShelfEdit();
  // Your shelf is yours; a venue's list goes with placing items, as its policies say.
  const canChange = !barId || (Array.isArray(caps) && (caps.includes('edit_drinks') || caps.includes('prep')));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const stockable = (line: WizardLine) => {
    const row = line.id && !line.batch && !line.prep && !line.later && !line.technique ? byId.get(line.id) : null;
    if (!row) return false;
    const kind = row.generic_id ? byId.get(row.generic_id)?.name : null;
    return isStockable({ name: row.name ?? line.name, kind, role: row.ingredient_role, ownPrep: !!barId && row.bar_id === barId });
  };

  const tap = (item: { id: string; name: string }, on: boolean) => {
    const reason = barId ? fixed.get(item.id) : undefined;
    if (on && reason) return setNote({ text: STAYS[reason](item.name, venueName) });
    const put = barId ? () => stock.add.mutate({ item, source: 'drink', fromName: drinkName }) : () => shelfEdit.add.mutate(item.id);
    const take = barId ? () => stock.remove.mutate(item.id) : () => shelfEdit.remove.mutate(item.id);
    const where = barId ? `${venueName}’s back bar` : 'your shelf';
    (on ? take : put)();
    setNote(on ? { text: `${item.name} is off ${where}`, undo: put } : { text: `${item.name} is on ${where}`, undo: take });
  };

  const toggle = (line: WizardLine) => {
    if (!line.id || !stockable(line)) return null;
    const item = { id: line.id, name: line.name };
    const on = barId ? stocked.has(line.id) || fixed.has(line.id) : !!shelf?.includes(line.id);
    return <StockButton name={line.name} on={on} where={barId ? `${venueName}’s back bar` : 'your shelf'} home={!barId} locked={!canChange} onPress={() => tap(item, on)} />;
  };

  const yours = barId ? 'your back bar' : 'your shelf';
  const hint = lines.some(stockable) ? `The bottle on the right: lit when it’s on ${yours}.${canChange ? ' Tap to change.' : ''}` : null;
  const footer =
    hint || note ? (
      <>
        {hint ? <Caption tone="muted">{hint}</Caption> : null}
        {note ? (
          <View role="status" style={[styles.note, { backgroundColor: ds.c.raised }]}>
            <Body style={styles.flex}>{note.text}</Body>
            {note.undo ? (
              <Button
                label="Undo"
                variant="ghost"
                onPress={() => {
                  note.undo?.();
                  setNote(null);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </>
    ) : null;
  return { toggle, footer };
}

interface StockButtonProps {
  name: string;
  on: boolean;
  /** "Little Rye’s back bar", "your shelf". */
  where: string;
  home: boolean;
  /** The role can't change it: it shows the state and doesn't switch. */
  locked: boolean;
  onPress: () => void;
}

/** The bottle: gold and filled when on, a quiet outline when not, grey when the role can't change it. */
function StockButton({ name, on, where, home, locked, onPress }: StockButtonProps) {
  const ds = useDs();
  const label = locked
    ? `${name} is ${on ? '' : 'not '}on the back bar. Your role can’t change it`
    : on
      ? `${name} is on ${where}`
      : `${name} is not on ${home ? 'your shelf' : 'the back bar'}. Add it`;
  const ink = locked ? ds.c.muted : on ? ds.accentText : ds.c.faint;
  return (
    <PressableScale onPress={onPress} disabled={locked} role="button" accessibilityLabel={label} {...pressedProps(on)} style={[styles.button, locked ? styles.locked : null]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
        <Path
          d="M10 2.5h4v4l1.6 2.6V20a1.6 1.6 0 0 1-1.6 1.6h-4A1.6 1.6 0 0 1 8.4 20V9.1L10 6.5z"
          fill={on ? withAlpha(ink, locked ? 0.3 : 0.35) : 'none'}
          stroke={ink}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
        <Path d="M8.4 13h7.2" stroke={ink} strokeWidth={1.7} strokeLinecap="round" />
      </Svg>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  locked: { opacity: 0.55 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.control, paddingLeft: space.lg, paddingRight: space.xs, minHeight: 52 },
  flex: { flex: 1 },
});
