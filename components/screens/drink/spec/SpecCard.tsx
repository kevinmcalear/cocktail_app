import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, SpecRow, useDs } from '@/components/ds';
import { font, space } from '@/constants/tokens';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import type { SpecLevels, SpecLine } from '@/lib/spec';
import { garnishNames, goesOutLine, lineRole, methodLine, scaledAmount, serveLine, specGroups, type Makes, type SpecLayout } from '@/lib/specView';
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
  /** The drink's method names, for Ingredients' method line ("double strain"). */
  methods?: readonly string[];
  /** The glass and the ice it's served over, in that order; blanks drop out. The garnish comes from the lines. */
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
 * (useSpecAccess, as app_recipe_presentation masks it), as boards Draw-bg,
 * Desk-page and And-page draw it:
 * Ingredients: the ruled rows in pour order, each line's role after its name
 * ("float", "garnish"), then the method in one line;
 * Steps: the same rows grouped by step, the garnish last under no heading,
 * then the glass and ice;
 * names only (a guest, the floor, a drink with no amounts): what's in it by
 * name with its role at the right (Garnish, Float, House-made), then how it's
 * served with its garnish. No toggle and no hint at what's held back;
 * nothing at all: the serve line.
 */
export function SpecCard({ itemId, barId, lines, maker, verb = null, methods = [], serve = [], onBatch, preview, onLine, goesOut }: SpecCardProps) {
  const { access } = useSpecAccess(itemId, barId, preview);
  const [view, setView] = useSpecView(maker);
  // Never saved: every page opens at Makes 1 (a Makes 3 carried onto the next drink is a mis-pour).
  const [makes, setMakes] = useState<Makes>(1);
  // ponytail: the person's own unit only. #1063 (bar units, waiting on Kevin) makes the bar's unit the default here; take its line when it lands.
  const unit = useSettingsStore((s) => s.specUnit);
  const measured = access.amounts && lines.some((l) => l.value !== null);
  const layout: SpecLayout = !access.names || !measured ? 'names' : view === 'steps' ? 'steps' : 'rows';
  const [glass, ice] = serve;
  const garnish = access.names ? garnishNames(lines) : [];

  const row = (l: SpecLine, underFloat = false) => (
    <SpecRow
      key={l.key}
      amount={measured ? (scaledAmount(l, makes, unit) ?? '') : ''}
      alignAmount={measured}
      dense
      ingredient={l.ingredient ?? 'Ingredient'}
      ingredientId={l.ingredient ? l.ingredientId : undefined}
      role={lineRole(l, layout, underFloat)}
      note={access.prep ? (l.note ?? undefined) : undefined}
      onPress={onLine && l.ingredientId ? () => onLine(l) : undefined}
    />
  );

  // Under the spec: Ingredients' method line (it says the glass, ice and garnish); Steps' glass and ice (the garnish is its last rows); otherwise how it's served, garnish and all.
  // A drink made in parts has a method per part: one line can't say them, so it reads how it's served (Steps says the rest).
  const parts = new Set(lines.map((l) => l.part ?? 1)).size > 1;
  const under =
    layout === 'rows' && !parts
      ? methodLine({ verb, methods, glass, ice, lines })
      : layout === 'steps'
        ? serveLine([glass, ice])
        : goesOut && layout === 'names'
          ? goesOutLine([glass, ice, ...garnish])
          : serveLine([glass, ice, ...garnish]);

  return (
    <View style={styles.card}>
      {measured ? <SpecControls view={view} onView={setView} makes={makes} onMakes={setMakes} onBatch={onBatch} /> : null}
      {access.names ? (
        layout === 'steps' ? (
          <View style={styles.groups}>
            {specGroups(lines, verb).map((g) => (
              <View key={g.key}>
                {g.title ? <GroupHead number={g.number} title={g.title} /> : null}
                {g.lines.map((l) => row(l, g.key === 'float'))}
              </View>
            ))}
          </View>
        ) : (
          <View>{lines.map((l) => row(l))}</View>
        )
      ) : null}
      {under ? <ServeLine text={under} /> : null}
    </View>
  );
}

function GroupHead({ number, title }: { number: string | null; title: string }) {
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
    </View>
  );
}

/** One quiet line under the spec: the method ("Shake · strain over a large cube · Candied ginger") or how it's served ("Rocks · Large cube · Candied ginger"). */
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
