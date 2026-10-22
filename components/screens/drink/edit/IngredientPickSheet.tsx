import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  Body,
  Caption,
  IngredientThumb,
  PressableScale,
  useDs,
} from "@/components/ds";
import {
  IngredientSearch,
  type CatalogIngredient,
} from "@/components/screens/addDrink/IngredientSearch";
import { MenuSheet } from "@/components/screens/menus/MenuSheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { layout, space } from "@/constants/tokens";
import { useBackBarIds } from "@/hooks/useBackBar";
import type { WizardPick } from "@/lib/drinkWizard";
import { bottlesFor } from "@/lib/swapBottle";

import type { DrinkEditor } from "./EditParts";

const SUGGESTED = 8;

interface IngredientPickSheetProps {
  editor: DrinkEditor;
  drink: string;
  /** The line being swapped; null adds a new line. */
  swapping: { id: string | null; name: string } | null;
  /** Ingredients already in the spec: not suggested again. */
  inSpec: readonly string[];
  onPick: (p: WizardPick) => void;
  onNew: (name: string) => void;
  onClose: () => void;
}

/**
 * Add a line, or swap one's ingredient (the editor's picker). A titled
 * MenuSheet like the drink page's swap (board KittySwap): search on top,
 * and something to pick before anything is typed. A swap offers other
 * bottles of the same kind first; both offer the common ingredients not
 * already in the spec. Typing hands over to IngredientSearch (aliases,
 * "Did you mean", add a new one); Return takes the top hit.
 */
export function IngredientPickSheet({
  editor,
  drink,
  swapping,
  inSpec,
  onPick,
  onNew,
  onClose,
}: IngredientPickSheetProps) {
  const ds = useDs();
  const [typing, setTyping] = useState(false);
  const ingredients = (editor.allIngredients ?? []) as CatalogIngredient[];
  const barId = editor.barId || null;
  const coreIds = editor.dropdowns?.coreIngredientIds;
  const backBar = useBackBarIds(barId, ingredients);

  // The React Compiler memoizes these.
  const kin = swapping?.id
    ? bottlesFor(swapping.id, ingredients, barId, SUGGESTED)
    : [];
  const skip = new Set([...inSpec, ...kin.map((k) => k.id)]);
  const core = new Set(coreIds ?? []);
  const common = ingredients
    .filter(
      (i) =>
        core.has(i.id) &&
        !skip.has(i.id) &&
        !i.hide_from_search &&
        i.name &&
        (!i.bar_id || i.bar_id === barId),
    )
    .slice(0, SUGGESTED);

  const row = (o: CatalogIngredient) => (
    <PressableScale
      key={o.id}
      role="button"
      accessibilityLabel={swapping ? `Use ${o.name} instead` : `Add ${o.name}`}
      onPress={() => onPick({ id: o.id, name: o.name ?? "" })}
      style={[styles.option, { borderBottomColor: ds.c.line }]}
    >
      <IngredientThumb id={o.id} name={o.name ?? ""} size={40} />
      <Body numberOfLines={1} style={styles.flex}>
        {o.name}
      </Body>
      <IconSymbol
        name={swapping ? "arrow.right" : "plus"}
        size={16}
        color={ds.c.muted}
      />
    </PressableScale>
  );

  const loading = !editor.dropdowns?.ingredients;
  return (
    <MenuSheet
      visible
      onClose={onClose}
      plain
      eyebrow={drink}
      title={swapping ? `Swap ${swapping.name}` : "Add an ingredient"}
    >
      <IngredientSearch
        ingredients={ingredients}
        coreIds={coreIds ? new Set(coreIds) : undefined}
        loading={loading}
        label={
          swapping
            ? "Search for what goes in instead"
            : "Search ingredients, or type a new one"
        }
        autoFocus
        onTyping={setTyping}
        brands
        backBar={barId ? backBar : undefined}
        onPick={(p) => (p.id ? onPick(p) : onNew(p.name))}
      />
      {typing ? null : loading ? (
        <Body tone="muted">Loading ingredients…</Body>
      ) : (
        <View role="list">
          {kin.length ? (
            <Caption tone="muted" style={styles.group}>
              {`Other ${swapping?.name ?? ""}`.trim()}
            </Caption>
          ) : null}
          {kin.map(row)}
          {common.length ? (
            <Caption tone="muted" style={styles.group}>
              {swapping ? "Common swaps" : "Common ingredients"}
            </Caption>
          ) : null}
          {common.map(row)}
          <Caption tone="muted" style={styles.group}>
            {swapping
              ? "Keeps the amount. Saved with Done."
              : "Can’t find it? Type its name to add it new."}
          </Caption>
        </View>
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: layout.minTapTarget + space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  group: { paddingTop: space.md, paddingBottom: space.xs },
  flex: { flex: 1 },
});
