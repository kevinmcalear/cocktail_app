/**
 * A write saved on this phone, as a row in "Waiting to send"
 * (components/UnsentWrites.tsx, Sta-errors: "Last Word off tonight", "Tried
 * 9:14pm · no connection"). Pure: from the write's key and variables
 * (hooks/barWrites.ts, hooks/useCreateDrink.ts). Apart from lib/unsentWords.ts
 * so the offline pill on every page doesn't load it.
 */

const named = (v: unknown, path: string[]): string => {
  let at: unknown = v;
  for (const p of path) at = at && typeof at === 'object' ? (at as Record<string, unknown>)[p] : undefined;
  return typeof at === 'string' ? at.trim() : '';
};

/** One write, as a row title: what it changes, in a few words. */
export function unsentTitle(key: readonly unknown[] | undefined, v: unknown): string {
  switch (key?.[1]) {
    case 'new-drink':
      return named(v, ['draft', 'name']) ? `${named(v, ['draft', 'name'])}, a new drink` : 'A new drink';
    case 'menu-layout':
      return named(v, ['name']) ? `Changes to ${named(v, ['name'])}` : 'Changes to a menu';
    case 'bottle':
      return named(v, ['name']) ? `${named(v, ['name'])}, a new bottle` : 'A new bottle';
    case 'off-tonight':
      return named(v, ['until']) ? 'A drink off tonight' : 'A drink back on tonight';
    case 'zone-count':
      return 'A stock count';
    case 'batch':
      return 'A batch';
    case 'run-swaps':
      return 'Run sheet swaps';
    case 'run-serves':
      return 'Run sheet serves';
    case 'shifts':
      return 'Rota changes';
    case 'handover':
      return 'A handover note';
    default:
      return 'A change';
  }
}

/** Under a row's title: why it hasn't sent ("Tried 9:14pm · no connection", Sta-errors). */
export function unsentDetail(failed: string | null, at: number, timeOf: (ms: number) => string): string {
  const when = at ? `Made ${timeOf(at)}` : 'Made on this phone';
  return failed ? `${when} · didn’t send: ${failed}` : `${when} · waiting for a connection`;
}
