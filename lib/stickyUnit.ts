// Its own module, imported only by the add-drink wizard, so the public drink and menu pages
// (which share lib/units and the settings store) don't carry it.

/**
 * The unit a pick on a spec line makes yours, so your next lines and next
 * drink start in it (Mat, 4 Nov): ml for an oz person, oz for an ml one.
 * Null changes nothing: a dash or a tbsp is for that line only, and a cl or g
 * person keeps the unit they chose in Settings.
 */
export function stickyUnit(picked: string | null | undefined, current: string): string | null {
  const metric = (u: string | null | undefined) => u === 'ml' || u === 'oz';
  return metric(picked) && metric(current) && picked !== current ? (picked ?? null) : null;
}

