import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BarAssignmentAccordion } from '@/components/BarAssignmentAccordion';
import { Body, Caption, Chip, Headline, Sheet, SheetScrollView, Surface, TextLink } from '@/components/ds';
import { IngredientSearch } from '@/components/screens/addDrink/IngredientSearch';
import { fontFamilies, space } from '@/constants/tokens';
import type { IngredientForm } from '@/hooks/useIngredientEditor';
import { useNearIngredients } from '@/hooks/useNearIngredients';
import { nearIngredient, sameIngredient, type IngredientAlias, type IngredientRow } from '@/lib/ingredientNames';

const SHEET_PAD = { paddingHorizontal: space.xl, paddingBottom: space.xxl };

type Pick = { id: string; name: string };

/**
 * Find an ingredient: for a new line, a line's swap, or what it's a kind of
 * (`allowNew` off: a kind of must already exist). The ingredient itself is
 * left out, so a recipe never holds itself.
 */
export function FindSheet({ title, ingredients, aliases, loading, excludeId, allowNew = true, onPick, onNew, onClear, onClose }: {
  title: string;
  ingredients: readonly { id: string; name: string | null }[];
  aliases?: readonly IngredientAlias[];
  loading: boolean;
  excludeId: string | null;
  allowNew?: boolean;
  onPick: (pick: Pick) => void;
  /** A name nothing matches: make it as a new ingredient. */
  onNew?: (name: string) => void;
  /** What it's a kind of, once set: take it off. */
  onClear?: () => void;
  onClose: () => void;
}) {
  const rows = excludeId ? ingredients.filter((i) => i.id !== excludeId) : ingredients;
  return (
    <Sheet style={SHEET_PAD} visible onClose={onClose} accessibilityLabel={title} keyboard>
      <View style={styles.search}>
        <IngredientSearch
          ingredients={rows}
          aliases={aliases}
          loading={loading}
          label={title}
          autoFocus
          allowNew={allowNew}
          onCancel={onClose}
          onPick={(p) => (p.id ? onPick({ id: p.id, name: p.name }) : onNew?.(p.name))}
        />
      </View>
      {onClear ? <TextLink label="Not a kind of anything" onPress={onClear} /> : null}
    </Sheet>
  );
}

/** Spirit tags: each one a chip to tick, in a sheet (the old category picker). */
export function TagsSheet({ tags, selected, onToggle, onClose }: { tags: readonly { id: string; name: string }[]; selected: readonly string[]; onToggle: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet style={SHEET_PAD} visible onClose={onClose} accessibilityLabel="Spirit tags" header={<Headline role="heading">Spirit tags</Headline>}>
      <SheetScrollView style={styles.scroll}>
        <View role="group" accessibilityLabel="Spirit tags" style={styles.chips}>
          {tags.map((t) => (
            <Chip key={t.id} label={t.name} multi selected={selected.includes(t.id)} onPress={() => onToggle(t.id)} />
          ))}
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

/**
 * Who can see it: the venue it belongs to and its visibility levels, as on the drink editor.
 * ponytail: the legacy BarAssignmentAccordion inside a ds Sheet, like the drink editor's AccessSheet; move both onto ds controls when the role lens board covers them.
 */
export function AccessSheet({ form, set, onClose }: { form: IngredientForm; set: (patch: Partial<IngredientForm>) => void; onClose: () => void }) {
  return (
    <Sheet style={SHEET_PAD} visible onClose={onClose} accessibilityLabel="Who can see it" header={<Headline role="heading">Who can see it</Headline>}>
      <ScrollView style={styles.access}>
        <BarAssignmentAccordion
          barId={form.barId}
          setBarId={(barId) => set({ barId })}
          overrideVisibility={form.overrideVisibility}
          setOverrideVisibility={(overrideVisibility) => set({ overrideVisibility })}
          overrideGeneric={form.overrideGeneric}
          setOverrideGeneric={(overrideGeneric) => set({ overrideGeneric })}
          overrideSpecific={form.overrideSpecific}
          setOverrideSpecific={(overrideSpecific) => set({ overrideSpecific })}
          overrideMeasurement={form.overrideMeasurement}
          setOverrideMeasurement={(overrideMeasurement) => set({ overrideMeasurement })}
          overridePrep={form.overridePrep}
          setOverridePrep={(overridePrep) => set({ overridePrep })}
        />
      </ScrollView>
    </Sheet>
  );
}

/**
 * One of each ingredient: when the name typed is already an ingredient (by
 * another spelling or name), say so before saving. A venue can keep its own
 * version under that name as a kind of it; anywhere else it needs its own
 * name, because the shared list holds one of each.
 */
export function SameNameNotice({ name, barId, rows, aliases, excludeId, generic, onGeneric }: {
  name: string;
  barId: string | null;
  rows: readonly IngredientRow[];
  aliases?: readonly IngredientAlias[];
  excludeId: string | null;
  generic: Pick | null;
  onGeneric: (generic: Pick) => void;
}) {
  const router = useRouter();
  const same = sameIngredient(name, rows, aliases);
  const match = same && same.id !== excludeId ? same : null;
  // A new one also asks the database for names spelled close (useNearIngredients); a saved one only checks the list, so its own name never nags.
  const near = useNearIngredients(name, rows, { skip: !!match || !name.trim() || !!excludeId, first: match ? null : nearIngredient(name, rows, aliases), limit: 1 })[0] ?? (excludeId && !match ? nearIngredient(name, rows, aliases) : null);
  const shown = match ?? (near && near.id !== excludeId ? near : null);
  if (!shown || generic?.id === shown.id) return null;
  const label = shown.name ?? '';
  return (
    <View role="alert">
      <Surface raised style={styles.notice}>
        <Body style={styles.bold}>{match ? `Already here: ${label}` : `Did you mean ${label}?`}</Body>
        <Caption tone="muted">
          {match && !barId
            ? `Use it in your drinks. Making your own version? Give it its own name, like "House ${label}", and it'll be a kind of ${label}.`
            : `Use it, or keep this as your own version: a kind of ${label}.`}
        </Caption>
        <View style={styles.links}>
          <TextLink label={`Open ${label}`} onPress={() => router.push(`/ingredient/${shown.id}`)} />
          <TextLink label={`Make this a kind of ${label}`} onPress={() => onGeneric({ id: shown.id, name: label })} />
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 420 },
  scroll: { maxHeight: 420 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  access: { maxHeight: 480 },
  notice: { gap: space.sm },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingTop: space.xs },
});
