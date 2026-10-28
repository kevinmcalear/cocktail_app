// A house-made spec line, opened in place (board drink-sheet-housemade): how
// many of this drink a batch makes, and when to start it.

const TO_ML: Record<string, number> = { ml: 1, cl: 10, l: 1000, oz: 29.5735 };

/** A volume in ml from an amount and unit; null for anything that isn't a volume. */
export function volumeMl(amount: number | null | undefined, unit: string | null | undefined): number | null {
  const per = TO_ML[(unit ?? '').trim().toLowerCase()];
  return amount != null && per ? amount * per : null;
}

/** "About 31": how many of this drink a batch of the prep makes. Null without both volumes. */
export function servesPerBatch(yieldAmount: number | null, yieldUnit: string | null, lineMl: number | null): number | null {
  const y = volumeMl(yieldAmount, yieldUnit);
  if (!y || !lineMl || lineMl <= 0) return null;
  return Math.floor(y / lineMl);
}

/** "Start 3 days before you need it."; null with no lead time. */
export function leadLine(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes >= 24 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return `Start ${days} day${days === 1 ? '' : 's'} before you need it.`;
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `Start ${hours} hour${hours === 1 ? '' : 's'} before you need it.`;
  }
  return `Takes about ${minutes} minutes.`;
}
