/**
 * "For 1 L of syrup that is 0.5 to 2 g. You need a 0.01 g scale.": a
 * technical ingredient's doses (as a share of the batch, "0.05 to 0.1%")
 * worked out for a litre. Null when no dose reads as a percentage.
 */
export function doseLine(doses: string[]): string | null {
  const pcts = doses.flatMap((d) => {
    // The share comes first: "0.1 to 0.3%", "0.33% (1 g in 300 g)". A note after it is ignored.
    const head = d.split('%')[0];
    if (head === d) return [];
    return [...head.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  });
  if (!pcts.length) return null;
  const grams = (pct: number) => Number((pct * 10).toFixed(2));
  const lo = grams(Math.min(...pcts));
  const hi = grams(Math.max(...pcts));
  const range = lo === hi ? `${lo} g` : `${lo} to ${hi} g`;
  return `For 1 L of syrup that is ${range}.${lo < 1 ? ' You need a 0.01 g scale.' : ''}`;
}
