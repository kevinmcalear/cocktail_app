import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { useGlassFill } from '@/hooks/useGlassFill';
import { usePricingSettings } from '@/hooks/usePricing';
import { fittedCostMinor } from '@/lib/glassFill';
import { formatMoney } from '@/lib/money';
import type { DatabaseItem } from '@/types/types';

import { FitGlassNote, FitGlassSheet } from '../FitGlass';
import type { DrinkEditor } from './EditParts';

interface FitGlassEditProps {
  editor: DrinkEditor;
  item: Pick<DatabaseItem, 'id' | 'ice_per_serve_g' | 'dilution_pct'>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Fit it to the glass in the editor (QA Q38): the draft spec against the
 * venue's glass, as it changes, and the sheet whose Use this spec puts the
 * fitted amounts in the draft (undo takes them back; Done saves them). Staff
 * who can see costs see the cost per drink before and after.
 */
export function FitGlassEdit({ editor, item, open, onOpen, onClose }: FitGlassEditProps) {
  const accent = useActiveVenue().venues.find((v) => v.id === editor.barId)?.accent ?? undefined;
  const lines = editor.recipeItems;
  const result = useGlassFill({
    barId: editor.barId,
    glasswareId: editor.glasswareId,
    glassModelId: 'glassModel' in editor ? editor.glassModel?.id : null,
    methodIds: editor.methodIds,
    iceId: editor.iceId,
    iceBuild: 'iceBuild' in editor ? editor.iceBuild : null,
    icePerServeG: item.ice_per_serve_g,
    dilutionPct: item.dilution_pct,
    lines: lines.map((l) => ({ amount: l.amount, unit: l.unit, ingredient: l.name })),
  });
  const fitted = result?.fitted;
  const costs = !!useCapabilities(editor.barId).data?.includes('costs');
  const { data: cost } = useDrinkCost(item.id, editor.barId, costs && open);
  const { data: pricing } = usePricingSettings(costs && open ? editor.barId : null);
  const nowMinor = cost && fitted ? fittedCostMinor(cost, lines.map((l) => l.name), lines.map((l) => l.amount), fitted) : null;
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
