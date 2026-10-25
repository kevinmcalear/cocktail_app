import { useRef, useState } from 'react';

import type { MakerBottle } from '@/hooks/useMakers';
import { useSetMakerBottlePicture } from '@/hooks/useMakerPhotos';
import { isBackLabel, matchName, nameFromFile, trayRows, type TrayPhoto } from '@/lib/folderMatch';
import type { NamedPhoto, PhotoFolder } from '@/lib/photoFolder';
import { readBottlePhoto } from '@/lib/readBottle';
import { AI_DECLINED } from '@/lib/readMenu';
import { cutout, cutoutAvailable } from '@/modules/subject-cutout';

/** How a photo found its bottle: its file name, its label, or the team's pick. */
export type FoundBy = 'file' | 'label' | 'picked' | null;

/** A photo in the tray: the file, its cut-out (phones that can), its match, and how it went. */
export interface FolderPhoto extends TrayPhoto {
  uri: string;
  mimeType: string;
  cut: string | null;
  foundBy: FoundBy;
  /** The label was read but fit more than one bottle, or none. */
  unclear: boolean;
  /** Still to be cut out or read. */
  pending: boolean;
  saved: 'saved' | 'failed' | null;
}

let next = 0;

/**
 * The folder match tray (ppl-maker board, step 4). Each photo is matched by
 * its file name first; a name that says nothing ("IMG_2231.jpg") has its
 * label read (read-bottle, one AI unit) and matched the same way. Phones that
 * can cut every bottle out as it goes. Nothing is saved until `use`, which
 * saves the ready photos one by one through set_maker_bottle_picture.
 */
export function usePhotoFolder(profileId: string, bottles: readonly MakerBottle[]) {
  const save = useSetMakerBottlePicture(profileId);
  const [name, setName] = useState<string | null>(null);
  const [photos, setPhotos] = useState<FolderPhoto[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const all = bottles.map((b) => b.id);
  const run = useRef({ busy: false });
  const patch = (key: string, change: Partial<FolderPhoto>) => setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const add = async (folder: PhotoFolder) => {
    // One batch at a time: a second add while one runs would end it early (the tray turns them away too).
    if (!folder.photos.length || run.current.busy) return;
    const batch = { busy: true };
    run.current = batch;
    if (folder.name) setName((was) => was ?? folder.name);
    const added = folder.photos.map((p) => fromFile(p, bottles, all));
    setPhotos((list) => [...list, ...added]);
    setWorking(true);
    // Labels are read until a "no" to Google AI or the day's AI limit; after that the rest ask.
    let canRead = true;
    for (const p of added) {
      // Cancel ends the batch: no more reads (each is an AI unit) for photos that have left.
      if (run.current !== batch) return;
      if (p.back) continue;
      const read = !p.foundBy && canRead && bottles.length ? readLabel(p) : null;
      const [cut, label] = await Promise.all([cutoutAvailable ? cutout(p.uri).then((c) => c?.uri ?? null) : null, read]);
      if (run.current !== batch) return;
      if (label?.stop) canRead = false;
      const match = label?.name ? matchName(label.name, bottles) : null;
      // A label that fits none keeps the file name's few to ask between.
      patch(p.key, { cut, pending: false, ...(match && 'sure' in match ? { bottleId: match.sure, foundBy: 'label' as const } : label ? { ask: match ? match.ask : p.ask, unclear: label.unclear } : {}) });
    }
    batch.busy = false;
    setWorking(false);
  };

  const rows = trayRows(photos, chosen);
  const ready = rows.filter((r) => r.kind === 'ready');

  /** Saves every ready photo; the ones that saved leave the tray, a failure stays to try again. */
  const use = async (): Promise<boolean> => {
    setSaving(true);
    let failed = false;
    const done = new Set<string>();
    for (const r of ready) {
      const p = photos.find((x) => x.key === r.photo.key) as FolderPhoto;
      const ok = await save.mutateAsync({ itemId: r.bottleId, picture: 'photo', photo: p.cut ?? p.uri }).then(
        () => true,
        () => false,
      );
      patch(p.key, { saved: ok ? 'saved' : 'failed' });
      failed ||= !ok;
      if (ok) done.add(r.bottleId);
    }
    // A saved bottle's other photos go with it, so they don't turn ready on a second try.
    forget(photos.filter((x) => x.bottleId && done.has(x.bottleId)));
    setPhotos((list) => list.filter((x) => !(x.bottleId && done.has(x.bottleId))));
    setSaving(false);
    return !failed;
  };

  return {
    name,
    photos,
    rows,
    readyCount: ready.length,
    working,
    saving,
    add,
    use,
    /** The bottle for a photo that asks which. */
    pick: (key: string, bottleId: string) => patch(key, { bottleId, foundBy: 'picked' }),
    /** Use this one: the photo a bottle with two keeps. */
    keep: (bottleId: string, key: string) => setChosen((c) => ({ ...c, [bottleId]: key })),
    clear: () => {
      run.current = { busy: false };
      setWorking(false);
      forget(photos);
      setPhotos([]);
      setChosen({});
      setName(null);
    },
  };
}

/**
 * What a photo's label says (read-bottle), or why not: too hard to read, or a
 * read that couldn't run. `stop` when no more should be tried: a "no" to
 * Google AI or the day's AI limit.
 */
async function readLabel(p: FolderPhoto): Promise<{ name: string | null; unclear: boolean; stop: boolean }> {
  try {
    return { name: (await readBottlePhoto({ uri: p.uri, mimeType: p.mimeType }))[0]?.name ?? null, unclear: true, stop: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    return { name: null, unclear: /read a label/i.test(message), stop: message === AI_DECLINED || /AI limit/i.test(message) };
  }
}

/** Lets go of the browser's copies of photos that have left the tray. */
function forget(list: readonly FolderPhoto[]) {
  if (typeof URL === 'undefined' || !URL.revokeObjectURL) return;
  for (const p of list) if (p.uri.startsWith('blob:')) URL.revokeObjectURL(p.uri);
}

function fromFile(p: NamedPhoto, bottles: readonly MakerBottle[], all: string[]): FolderPhoto {
  const back = isBackLabel(p.fileName);
  const match = back ? null : matchName(nameFromFile(p.fileName), bottles);
  const sure = match && 'sure' in match ? match.sure : null;
  return {
    key: `f${next++}`,
    fileName: p.fileName,
    uri: p.uri,
    mimeType: p.mimeType,
    cut: null,
    back,
    bottleId: sure,
    foundBy: sure ? 'file' : null,
    // A name that fits a few bottles asks between them; one that fits none waits for its label.
    ask: match && 'ask' in match ? match.ask : all,
    unclear: false,
    pending: !back,
    saved: null,
  };
}
