import { GLASSWARE_ICON_KEYS, type GlasswareIconKey } from '@/lib/glasswareIcons';

/** Grow/shrink a glassware mask so consecutive icons never match. */
export function syncGlassMask(
  prev: GlasswareIconKey[],
  nextLen: number,
  keys: readonly GlasswareIconKey[] = GLASSWARE_ICON_KEYS,
): GlasswareIconKey[] {
  if (nextLen <= 0) return [];
  if (nextLen < prev.length) return prev.slice(0, nextLen);

  const out = prev.slice();
  while (out.length < nextLen) {
    const last = out[out.length - 1];
    const pool = keys.length > 1 ? keys.filter((k) => k !== last) : keys;
    out.push(pool[Math.floor(Math.random() * pool.length)]!);
  }
  return out;
}

// ponytail: self-check — `npx tsx lib/syncGlassMask.ts`
if (typeof require !== 'undefined' && require.main === module) {
  const a = syncGlassMask([], 5);
  console.assert(a.length === 5, 'length');
  for (let i = 1; i < a.length; i++) {
    console.assert(a[i] !== a[i - 1], `adjacent ${i}`);
  }
  console.assert(syncGlassMask(a, 2).length === 2, 'shrink');
  console.assert(syncGlassMask(['Martini'], 1)[0] === 'Martini', 'keep');
  console.log('syncGlassMask ok');
}
