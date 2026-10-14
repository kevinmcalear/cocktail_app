import { loadAsync } from 'expo-font';
import { useEffect, useSyncExternalStore } from 'react';

import { displayFaces, type DisplayFace } from '@/constants/tokens';

import { LAZY_FACE_FONTS } from './fonts';

/**
 * The lazy display faces that have finished loading, as ",playfair,tenor,".
 * A string, so a render can compare it, and React re-renders when it changes.
 */
let loaded = ',';
const listeners = new Set<() => void>();
const pending = new Map<DisplayFace, Promise<void>>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => loaded;
// The static web export renders before any font has loaded.
const serverSnapshot = () => ',';

/** True when a face can be drawn now: always for the faces loaded at start, else once its files are in. */
export function faceReady(face: DisplayFace, done: string): boolean {
  return !LAZY_FACE_FONTS[face] || done.includes(`,${face},`);
}

/** Loads a lazy face once. A failure (offline) leaves it unloaded, so its text stays in Instrument Serif. */
function loadFace(face: DisplayFace): Promise<void> {
  const fonts = LAZY_FACE_FONTS[face];
  if (!fonts || faceReady(face, loaded)) return Promise.resolve();
  const running = pending.get(face);
  if (running) return running;
  const load = loadAsync(fonts)
    .then(() => {
      loaded = `${loaded}${face},`;
      listeners.forEach((l) => l());
    })
    .catch((e: unknown) => {
      pending.delete(face);
      console.warn(`The ${displayFaces[face].label} font didn't load`, e);
    });
  pending.set(face, load);
  return load;
}

/**
 * Fetches the given display faces if they aren't in yet, and returns a lookup
 * for their font family: the face itself once it has loaded, Instrument Serif
 * until then. Venues not using a lazy face never download it.
 */
export function useDisplayFaces(faces: readonly (DisplayFace | null | undefined)[]): (face: DisplayFace, style?: 'regular' | 'italic') => string {
  const done = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const missing = faces.filter((f): f is DisplayFace => !!f && !faceReady(f, done)).join(',');
  useEffect(() => {
    if (missing) missing.split(',').forEach((f) => void loadFace(f as DisplayFace));
  }, [missing]);
  return (face, style = 'regular') => displayFaces[faceReady(face, done) ? face : 'instrument'][style];
}

/** The face to draw with now: the one asked for once it has loaded, else Instrument Serif. */
export function useLoadedFace(face: DisplayFace): DisplayFace {
  const done = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const ready = faceReady(face, done);
  useEffect(() => {
    if (!ready) void loadFace(face);
  }, [face, ready]);
  return ready ? face : 'instrument';
}
