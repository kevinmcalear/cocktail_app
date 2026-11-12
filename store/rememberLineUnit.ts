import { stickyUnit } from '@/lib/stickyUnit';
import { lineUnitAt } from '@/lib/units';
import { unitIn, useSettingsStore } from '@/store/useSettingsStore';

/**
 * A unit picked on a spec line, or typed with a pour ("1 oz lemon"): ml or oz
 * becomes your own Units (lib/stickyUnit), so the next line and the next
 * drink start in it, as the drink page's switch does; and the bar's, so
 * at that bar it sticks even after a pick at another. Lines already written keep theirs.
 * Its own module, imported only by the add-drink wizard, so the public pages don't carry it.
 */
export function rememberLineUnit(unit: string | null | undefined): void {
  const s = useSettingsStore.getState();
  // The bar's own first (getLineUnit reads it before yours), then yours, as before.
  const here = s.barId ? stickyUnit(unit, lineUnitAt(s.lineUnits, s.barId, unitIn(s))) : null;
  if (here && s.barId) s.setLineUnit(s.barId, here);
  const next = stickyUnit(unit, unitIn(s));
  if (next) s.setUnits(next);
}
