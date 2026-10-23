import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, LockedSection, SpecRow, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { Choice } from '@/components/screens/batch/BatchParts';
import { HouseMadeSheet } from './HouseMadeSheet';
import { ToolsSheet, type ToolsSheetProps } from '@/components/tools/ToolsSheet';
import { useMode } from '@/hooks/useMode';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useItemEditAccess } from '@/hooks/useViewAs';
import { withAlpha } from '@/lib/color';
import { roleLabel } from '@/lib/roles';
import { lineAmount } from '@/lib/drinkMath';
import { ratio, specLines, type PresentationRecipe, type SpecLevels } from '@/lib/spec';
import { useSettingsStore, type SpecUnit } from '@/store/useSettingsStore';

const UNITS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'oz', label: 'oz' },
] as const;

interface SpecSectionProps {
  itemId: string;
  barId: string | null;
  recipes: PresentationRecipe[] | null | undefined;
  /** /dev/drink only: a simulated role and levels instead of the real ones. */
  preview?: { role: number; levels: SpecLevels };
  /** "At home" at home (board drink-phone-home); "Spec" everywhere else. */
  heading?: string;
  /** Beside the heading: "You have 4 of 5", "With Little Rye's bottles". */
  caption?: string | null;
  /** Spec line keys your shelf doesn't have: marked "Not on your shelf". */
  missing?: readonly string[];
  /** Right under the lines: method, glass, ice and garnish (MakeLine). Shown even when the lines are locked. */
  make?: ReactNode;
  /** Someone else's drink: one Make a riff button under the spec, with what it does (Eddie, 16 Oct). */
  riff?: { onPress: () => void; note: string } | null;
  /** Under that, inside the section: the method's steps, what to do about a missing bottle. */
  children?: ReactNode;
}

/** The spec's proportions at a glance. Decorative: the rows carry the numbers. */
function RatioBar({ shares }: { shares: { key: string; share: number }[] }) {
  const ds = useDs();
  return (
    <View style={styles.ratio} aria-hidden>
      {shares.map((s, i) => (
        <View key={s.key} style={{ flex: s.share, backgroundColor: withAlpha(ds.accentText, Math.max(0.25, 1 - i * 0.22)) }} />
      ))}
    </View>
  );
}

/**
 * The spec, showing exactly what this role can see. Dense rows and no ABV
 * under each name, so a whole spec fits on a phone's first screen; each
 * line's strength is in the strength sheet (ABV, under More). Anything the server
 * withheld stays on the page as a locked section that says who can open it.
 */
export function SpecSection({ itemId, barId, recipes, preview, heading = 'Spec', caption, missing = [], make, riff, children }: SpecSectionProps) {
  const ds = useDs();
  const router = useRouter();
  // The same rule as the drink page's Batch and the server's view: levels, moved by the role's specs grant or revoke.
  const { access, levels } = useSpecAccess(itemId, barId, preview);
  const lines = specLines(recipes);
  // Remembered per person: the unit the amounts read in.
  const specUnit = useSettingsStore((s) => s.specUnit);
  const setSpecUnit = useSettingsStore((s) => s.setSpecUnit);
  const unit: SpecUnit = specUnit;
  const [convert, setConvert] = useState<ToolsSheetProps['amount']>(null);
  // A house-made line opens in place (board drink-sheet-housemade); anything else goes to its page.
  const [houseLine, setHouseLine] = useState<(typeof lines)[number] | null>(null);
  // The drink's own people fix the spec in the editor (More › Edit), never from the read view; anyone else can make it their own riff. A venue's drink is fixed in venue mode, not from home.
  const homeVenueDrink = useMode().mode === 'home' && !!barId;
  const canEdit = useItemEditAccess(!preview && !homeVenueDrink ? { id: itemId, bar_id: barId } : null) === 'edit';
  const open = (l: (typeof lines)[number]) => (l.houseMade ? setHouseLine(l) : router.push(`/ingredient/${l.ingredientId}` as never));
  const opensAt = (level: number | undefined) => (level ? roleLabel(level) : 'a higher role');

  if (!lines.length) {
    return (
      <View style={styles.section}>
        <Headline role="heading">{heading}</Headline>
        <Body tone="muted">No spec yet.</Body>
        {make}
      </View>
    );
  }

  if (!access.names) {
    return (
      <View style={styles.section}>
        <LockedSection title="Spec" unlocked={false} opensAt={opensAt(levels ? Math.min(levels.generic, levels.brand) : undefined)} note="Method and prep notes open with it.">
          {null}
        </LockedSection>
        {make}
      </View>
    );
  }

  const shares = access.amounts ? ratio(lines) : null;
  const measured = access.amounts && lines.some((l) => l.amount);
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Headline role="heading">{heading}</Headline>
          {caption ? <Caption tone="muted">{caption}</Caption> : null}
        </View>
        {measured ? <Choice label="Read the amounts in" options={UNITS} value={unit} onChange={setSpecUnit} /> : null}
      </View>
      {shares ? <RatioBar shares={shares} /> : null}
      {!access.amounts ? (
        <View style={styles.lockNote}>
          <IconSymbol name="lock.fill" size={13} color={ds.c.muted} />
          <Caption tone="muted">Amounts open at {opensAt(levels?.measurement)}</Caption>
        </View>
      ) : null}
      <View>
        {lines.map((l) => (
          <SpecRow
            key={l.key}
            amount={access.amounts ? (lineAmount(l, unit) ?? '') : ''}
            alignAmount={measured}
            dense
            ingredient={l.ingredient ?? 'Hidden ingredient'}
            ingredientId={l.ingredient ? l.ingredientId : undefined}
            optional={l.optional}
            houseMade={l.houseMade}
            note={l.note ?? undefined}
            flag={missing.includes(l.key) ? 'Not on your shelf' : undefined}
            // The amount opens the conversions; the rest of the line opens the ingredient.
            onPressAmount={access.amounts && l.value !== null && !preview ? () => setConvert({ value: l.value!, unit: l.unit ?? 'ml', name: l.ingredient, abv: l.abv, density: l.density }) : undefined}
            onPress={l.ingredientId && !preview ? () => open(l) : undefined}
          />
        ))}
      </View>
      {/* Not yours to fix: one way to change it, as your own riff (board create-eddie-oct16). */}
      {riff && !canEdit && !preview ? (
        <View style={styles.riff}>
          <Button label="Make a riff" icon="arrow.turn.down.right" variant="secondary" onPress={riff.onPress} />
          <Caption tone="muted">{riff.note}</Caption>
        </View>
      ) : null}
      {make}
      {children}
      {houseLine ? <HouseMadeSheet line={houseLine} onClose={() => setHouseLine(null)} /> : null}
      {convert ? <ToolsSheet visible onClose={() => setConvert(null)} tool="convert" amount={convert} scheme="dark" /> : null}
      {!access.prep && levels ? (
        <LockedSection title="Prep notes" unlocked={false} opensAt={opensAt(levels.prep)}>
          {null}
        </LockedSection>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexShrink: 1, flexWrap: 'wrap' },
  ratio: { flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  riff: { gap: space.sm },
});
