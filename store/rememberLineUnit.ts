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
  // Kept even when it's already the start unit, so a pick at another bar can't move this one's.
  const metric = (u: string | null | undefined) => u === 'ml' || u === 'oz';
  if (s.barId && metric(unit) && metric(lineUnitAt(s.lineUnits, s.barId, unitIn(s))) && s.lineUnits[s.barId] !== unit) s.setLineUnit(s.barId, unit!);
  const next = stickyUnit(unit, unitIn(s));
  // Not setUnits: that is a Units choice, which clears the bars' picks.
  if (next) useSettingsStore.setState({ units: next, unitsChecked: true });
}
