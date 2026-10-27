import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { useGlassFill, type GlassFillResult } from '@/hooks/useGlassFill';
import { usePricingSettings } from '@/hooks/usePricing';
import { fittedCostMinor } from '@/lib/glassFill';
import { formatMoney } from '@/lib/money';
import { specLines, type PresentationRecipe } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import { FitGlassNote, FitGlassSheet } from '../FitGlass';
import type { DrinkEditor } from './EditParts';

type FitItem = Pick<DatabaseItem, 'id' | 'ice_per_serve_g' | 'dilution_pct' | 'recipes'>;

interface FitGlassEditProps {
  editor: DrinkEditor;
  item: FitItem;
  /** useDraftGlassFill's: the editor's Glass sheet reads the same one. */
  result: GlassFillResult | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/** The draft spec against the venue's glass (QA Q38), as it changes: the note, Fit it and the Glass sheet all read this one. */
export function useDraftGlassFill(editor: DrinkEditor, item: Omit<FitItem, 'id' | 'recipes'> | null | undefined): GlassFillResult | null {
  return useGlassFill(
    item
      ? {
          barId: editor.barId,
          glasswareId: editor.glasswareId,
          glassModelId: 'glassModel' in editor ? editor.glassModel?.id : null,
          methodIds: editor.methodIds,
          iceId: editor.iceId,
          iceBuild: 'iceBuild' in editor ? editor.iceBuild : null,
          icePerServeG: item.ice_per_serve_g,
          dilutionPct: item.dilution_pct,
          lines: editor.recipeItems.map((l) => ({ amount: l.amount, unit: l.unit, ingredient: l.name })),
        }
      : null
  );
}

/**
 * Fit it to the glass in the editor (QA Q38): the note under the draft spec,
 * and the sheet whose Use this spec puts the fitted amounts in the draft
 * (undo takes them back; Done saves them). Staff who can see costs see the
 * cost per drink before and after, while the draft's spec is the saved one
 * (the cost is the saved spec's).
 */
export function FitGlassEdit({ editor, item, result, open, onOpen, onClose }: FitGlassEditProps) {
  const accent = useActiveVenue().venues.find((v) => v.id === editor.barId)?.accent ?? undefined;
  const lines = editor.recipeItems;
  const fitted = result?.fitted;
  const costs = !!useCapabilities(open ? editor.barId : null).data?.includes('costs');
  const { data: cost } = useDrinkCost(item.id, editor.barId, costs && open);
  const { data: pricing } = usePricingSettings(costs && open ? editor.barId : null);
  const saved = specLines(item.recipes as PresentationRecipe[] | undefined);
  const asSaved = saved.length === lines.length && lines.every((l, i) => Number(l.amount) === (saved[i].value ?? NaN));
  const nowMinor = cost && fitted && asSaved ? fittedCostMinor(cost, lines.map((l) => l.name), lines.map((l) => l.amount), fitted) : null;
  const was = formatMoney(cost?.total_minor, pricing?.currency);
  const now = formatMoney(nowMinor, pricing?.currency);
  const use = () => {
    if (fitted) editor.setRecipeItems((prev) => prev.map((l, i) => (fitted.lines[i]?.changed ? { ...l, amount: fitted.lines[i].amount } : l)));
    onClose();
  };
  return (
    <>
      <FitGlassNote result={result} onFit={onOpen} />
      {open && result && fitted ? <FitGlassSheet result={result} names={lines.map((l) => l.name)} amounts={lines.map((l) => l.amount)} onUse={use} onClose={onClose} cost={was && now ? { was, now } : null} accent={accent} /> : null}
    </>
  );
}
