/**
 * A folder of bottle photos matched to a maker's bottles (ppl-maker board,
 * step 4). A photo's file name, or the label read off it, goes through the
 * near-name rule (lib/nearName.ts) against the maker's bottle names: one
 * closest bottle is a sure match, a tie asks which. Back labels are left out,
 * and a bottle with two photos keeps one. Pure; checked by lib/folderMatch.check.ts.
 */
import { nearMatcher } from './nearName';

/** Words in file names that say nothing about which bottle it is. */
const NOISE = new Set(['front', 'side', 'label', 'img', 'image', 'photo', 'pic', 'dsc', 'dscf', 'pxl', 'final', 'hero', 'packshot', 'pack', 'shot', 'bottle', 'copy', 'edit', 'web', 'hires', 'lores', 'white', 'transparent', 'cutout', 'jpg', 'jpeg', 'png', 'webp', 'heic']);
const BACK = new Set(['back', 'rear', 'reverse']);

/** A file name's words: extension off, split at _ - . spaces, case changes and digits. */
export function fileWords(fileName: string): string[] {
  return fileName
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)|(\d)([A-Za-z])/g, '$1$3 $2$4')
    .toLowerCase()
    .split(/[^a-z0-9À-ɏ]+/)
    .filter(Boolean);
}

/** A photo of a back label, from its file name ("HL_Rosso_back.png"). */
export function isBackLabel(fileName: string): boolean {
  return fileWords(fileName).some((w) => BACK.has(w));
}

/**
 * What a file name says the bottle is called, or '' when it says nothing
 * ("IMG_2231.jpg"): its words less sizes, numbers, two-letter codes and words
 * like "front" or "packshot". "HL_DryGin_700_front.png" is "dry gin".
 */
export function nameFromFile(fileName: string): string {
  return fileWords(fileName)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !/^\d+(ml|cl|l)$/.test(w) && !NOISE.has(w) && !BACK.has(w))
    .join(' ');
}

export interface Named {
  id: string;
  name: string;
}

/** A sure match, the closest few to ask between, or nothing close. */
export type NameMatch = { sure: string } | { ask: string[] } | null;

/**
 * The bottle a name fits. Every bottle tied for closest is asked between
 * (up to `limit`); a single closest one is sure.
 */
export function matchName(text: string, bottles: readonly Named[], limit = 4): NameMatch {
  if (!text.trim()) return null;
  const score = nearMatcher(text);
  const scored = bottles
    .map((b) => ({ id: b.id, name: b.name, score: score(b.name) }))
    .filter((b): b is Named & { score: number } => b.score !== null)
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length);
  if (!scored.length) return null;
  const best = scored[0].score;
  const tied = scored.filter((b) => b.score === best);
  return tied.length === 1 ? { sure: tied[0].id } : { ask: tied.slice(0, limit).map((b) => b.id) };
}

/** One photo in the tray, as matched (or picked by hand). */
export interface TrayPhoto {
  key: string;
  fileName: string;
  /** The bottle it's for: a sure match or the one picked. */
  bottleId: string | null;
  /** The bottles to ask between, closest first; every bottle when none came close. */
  ask: string[];
  back: boolean;
}

/** Where a photo stands: ready to use, waiting on a pick, another of a bottle that has one, or left out. */
export type TrayRow =
  | { kind: 'ready'; photo: TrayPhoto; bottleId: string }
  | { kind: 'which'; photo: TrayPhoto }
  | { kind: 'another'; photo: TrayPhoto; bottleId: string }
  | { kind: 'back'; photo: TrayPhoto };

const ORDER: Record<TrayRow['kind'], number> = { ready: 0, which: 1, another: 2, back: 3 };

/**
 * Every photo's place in the tray: ready ones first, then the ones to check,
 * then those left out, each in the order given. A bottle with more
 * than one photo uses `chosen[bottleId]` (the one picked with Use this one),
 * else its first front photo, else its first; the rest are "another photo".
 */
export function trayRows(photos: readonly TrayPhoto[], chosen: Readonly<Record<string, string>> = {}): TrayRow[] {
  const byBottle = new Map<string, TrayPhoto[]>();
  for (const p of photos) if (!p.back && p.bottleId) byBottle.set(p.bottleId, [...(byBottle.get(p.bottleId) ?? []), p]);
  const primary = new Map<string, string>();
  for (const [bottleId, list] of byBottle) {
    const pick = list.find((p) => p.key === chosen[bottleId]) ?? list.find((p) => fileWords(p.fileName).includes('front')) ?? list[0];
    primary.set(bottleId, pick.key);
  }
  return photos
    .map((photo): TrayRow => {
      if (photo.back) return { kind: 'back', photo };
      if (!photo.bottleId) return { kind: 'which', photo };
      return primary.get(photo.bottleId) === photo.key ? { kind: 'ready', photo, bottleId: photo.bottleId } : { kind: 'another', photo, bottleId: photo.bottleId };
    })
    .sort((x, y) => ORDER[x.kind] - ORDER[y.kind]);
}

/** "3 ready · 2 to check · 1 left out", leaving out the parts that are none. */
export function traySummary(rows: readonly TrayRow[]): string {
  const ready = rows.filter((r) => r.kind === 'ready').length;
  const check = rows.filter((r) => r.kind === 'which' || r.kind === 'another').length;
  const out = rows.filter((r) => r.kind === 'back').length;
  return [`${ready} ready`, check ? `${check} to check` : null, out ? `${out} left out` : null].filter(Boolean).join(' · ');
}

/** A bottle's name without the maker's own words at its start: "Harbour Lane Dry Gin" is "Dry Gin". */
export function shortName(name: string, makerName: string): string {
  const maker = new Set(fileWords(makerName));
  const parts = name.split(/\s+/);
  let i = 0;
  while (i < parts.length - 1 && maker.has(parts[i].toLowerCase())) i++;
  return parts.slice(i).join(' ');
}
