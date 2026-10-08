import type { ReadFile } from '@/lib/readAnything';

/** Drinks handed from a menu paste to Bring in, as its list text (lib/paste bringInText). Cleared when that screen reads it. */
let staged: string | null = null;

export function stageBringIn(text: string): void {
  staged = text;
}

export function takeBringIn(): string | null {
  const text = staged;
  staged = null;
  return text;
}

/** Photos or PDFs dropped or pasted somewhere else in the app, for Bring in to read when it opens. */
let stagedFiles: ReadFile[] | null = null;

export function stageBringInFiles(files: ReadFile[]): void {
  stagedFiles = files;
}

/** Something dropped or pasted while Bring in is already open. */
export type BringInDelivery = { files: ReadFile[] } | { text: string };

let listener: ((delivery: BringInDelivery) => void) | null = null;

/**
 * The open Bring in screen takes drops and pastes from anywhere, and files
 * staged before it opened (delivered just after it subscribes). Returns the
 * unsubscribe.
 */
export function listenBringIn(take: (delivery: BringInDelivery) => void): () => void {
  listener = take;
  const files = stagedFiles;
  stagedFiles = null;
  // Whoever is listening by then gets them; a screen that remounted in between still does.
  if (files?.length) queueMicrotask(() => (listener ? listener({ files }) : (stagedFiles = files)));
  return () => {
    if (listener === take) listener = null;
  };
}

/** Hands a drop or paste to the open Bring in screen. False when none is listening. */
export function deliverBringIn(delivery: BringInDelivery): boolean {
  if (!listener) return false;
  listener(delivery);
  return true;
}
