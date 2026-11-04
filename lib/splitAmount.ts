/**
 * An amount as its number and its unit (on its own, off lib/units, which every web page loads, and off lib/specLines, which pulls in lib/batch: the public drink page reads it), so the unit can be set smaller
 * (every spec board: the amount 22, its unit 12 and muted). A ranged or mixed
 * number stays whole ("2-3 dashes", "1 ½ oz"); a word with no number ("Top",
 * "Rinse") is all number, no unit.
 */
export function splitAmount(text: string): { value: string; unit: string } {
  const m = /^([\d.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:[\s-]+[\d/½¼¾⅓⅔⅛⅜⅝⅞]+)?)\s+(\S.*)$/.exec(text.trim());
  return m ? { value: m[1], unit: m[2] } : { value: text.trim(), unit: '' };
}
