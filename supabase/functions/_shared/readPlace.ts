// Where on the pages something was read, so the app can draw it on the photo,
// crop the printed line beside its row, and number bottles on a shelf. Plain
// TypeScript (no Deno APIs) so the check scripts run it under Node too.

/** [ymin, xmin, ymax, xmax], each in thousandths of the page (the model's own box convention). */
export type ReadBox = [number, number, number, number];

export interface ReadPlace {
  /** Which of the files it was read from, 0 for the first. */
  page: number;
  box: ReadBox;
}

/** The model's page and box, or null when either is missing or doesn't make a box. */
export function cleanPlace(page: unknown, box: unknown, files: number): ReadPlace | null {
  const p = typeof page === "number" ? Math.round(page) : NaN;
  if (!Number.isInteger(p) || p < 0 || p >= files || !Array.isArray(box) || box.length !== 4) return null;
  const n = box.map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(1000, Math.max(0, v))) : NaN));
  if (n.some(Number.isNaN)) return null;
  const [ymin, xmin, ymax, xmax] = n;
  if (ymax - ymin < 5 || xmax - xmin < 5) return null;
  return { page: p, box: [ymin, xmin, ymax, xmax] };
}

/** The schema fields for a place, to add to an object's properties. */
export const PLACE_SCHEMA = {
  page: { type: "INTEGER", nullable: true },
  box: { type: "ARRAY", items: { type: "INTEGER" }, nullable: true },
};
