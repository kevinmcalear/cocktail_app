import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, SpecRow, useDs } from '@/components/ds';
import { font, space } from '@/constants/tokens';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import type { SpecLevels, SpecLine } from '@/lib/spec';
import { MAKES, scaledAmount, serveLine, specGroups, type Makes } from '@/lib/specView';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSpecView } from '@/store/useSpecViewStore';

import { SpecControls } from './SpecControls';

export interface SpecCardProps {
  itemId: string;
  barId: string | null;
  lines: SpecLine[];
  /** Makes the drink: a bar's staff, or a home bartender's own drink. Opens in Steps until they pick. */
  maker: boolean;
  /** The method as a step's name ("Shake", lib/specView methodVerb). */
  verb?: string | null;
  /** The glass, ice and garnish, in that order; blanks drop out. */
  serve?: (string | null | undefined)[];
  /** "A batch…" in the Makes menu: open today's Batch sheet. */
  onBatch?: () => void;
  /** Gallery and /dev/drink: a simulated role instead of the real one. */
  preview?: { role: number; levels: SpecLevels };
  /** A line's name was tapped: its ingredient or house-made page. */
  onLine?: (line: SpecLine) => void;
  /** The floor's serve line: "Goes out: rocks, candied ginger" (board Decided-who-floor). */
  goesOut?: boolean;
}

/**
 * The spec block of the 2027 drink page, shown by permission
 * (useSpecAccess, as app_recipe_presentation masks it):
 * amounts visible: Ingredients | Steps, Makes, the ruled rows, the serve line;
 * names only (a guest, the floor): what's in it by name and the serve line,
 * with no toggle and no hint at what's held back; nothing at all: the serve line.
 */
export function SpecCard({ itemId, barId, lines, maker, verb = null, serve = [], onBatch, preview, onLine, goesOut }: SpecCardProps) {
  const { access } = useSpecAccess(itemId, barId, preview);
  const [view, setView] = useSpecView(maker);
  // Never saved: every page opens at Makes 1 (a Makes 3 carried onto the next drink is a mis-pour).
  const [makes, setMakes] = useState<Makes>(1);
  const unit = useSettingsStore((s) => s.specUnit);
  const served = serveLine(serve);
  const measured = access.amounts && lines.some((l) => l.value !== null);

  const row = (l: SpecLine, tag?: string) => (
    <SpecRow
      key={l.key}
      amount={measured ? (scaledAmount(l, makes, unit) ?? '') : ''}
      alignAmount={measured}
      dense
      ingredient={l.ingredient ?? 'Ingredient'}
      ingredientId={l.ingredient ? l.ingredientId : undefined}
      optional={l.optional}
      floated={l.float && view === 'ingredients'}
      houseMade={l.houseMade}
      note={access.prep ? (l.note ?? undefined) : undefined}
      flag={tag}
      onPress={onLine && l.ingredientId ? () => onLine(l) : undefined}
    />
  );

  return (
    <View style={styles.card}>
      {measured ? <SpecControls view={view} onView={setView} makes={String(makes)} sizes={SIZES} picked={String(makes)} onPick={(k) => setMakes(Number(k) as Makes)} more={onBatch ? { label: 'A batch…', onPress: onBatch } : undefined} /> : null}
      {access.names ? (
        measured && view === 'steps' ? (
          <View style={styles.groups}>
            {specGroups(lines, verb).map((g) => (
              <View key={g.key}>
                {g.title ? <GroupHead number={g.number} title={g.title} /> : null}
                {g.lines.map((l) => row(l, g.tag))}
              </View>
            ))}
          </View>
        ) : (
          <View>{lines.map((l) => row(l))}</View>
        )
      ) : null}
      {served ? <ServeLine text={goesOut ? `Goes out: ${served.toLowerCase()}` : served} /> : null}
    </View>
  );
}

const SIZES = MAKES.map((n) => ({ key: String(n), label: `Makes ${n}` }));

export function GroupHead({ number, title, aside }: { number: string | null; title: string; aside?: string | null }) {
  const ds = useDs();
  return (
    <View style={styles.head} role="heading" aria-level={3}>
      {number ? (
        <DsText variant="label" color={ds.accentText} style={font.figuresMedium}>
          {number}
        </DsText>
      ) : null}
      <DsText variant="label" color={ds.accentText} style={font.semiBold}>
        {title}
      </DsText>
      {aside ? (
        <DsText variant="caption" tone="muted">
          {aside}
        </DsText>
      ) : null}
    </View>
  );
}

/** The glass, ice and garnish in one quiet line under the spec ("Rocks · Large cube · Candied ginger"). */
export function ServeLine({ text }: { text: string }) {
  return (
    <DsText variant="label" tone="muted">
      {text}
    </DsText>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  groups: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingBottom: space.xs },
});
