import { useState } from 'react';

import type { MakerBottle } from '@/hooks/useMakers';
import { useSetMakerBottlePicture } from '@/hooks/useMakerPhotos';
import { isBackLabel, matchName, nameFromFile, trayRows, type TrayPhoto } from '@/lib/folderMatch';
import type { NamedPhoto, PhotoFolder } from '@/lib/photoFolder';
import { readBottlePhoto } from '@/lib/readBottle';
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
  const patch = (key: string, change: Partial<FolderPhoto>) => setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const add = async (folder: PhotoFolder) => {
    if (!folder.photos.length) return;
    if (folder.name) setName((was) => was ?? folder.name);
    const added = folder.photos.map((p) => fromFile(p, bottles, all));
    setPhotos((list) => [...list, ...added]);
    setWorking(true);
    // Labels are read only while reading works: a day's AI limit or a "no" to Google AI stops it, and the rest ask.
    let canRead = true;
    for (const p of added) {
      if (p.back) continue;
      const cut = cutoutAvailable ? ((await cutout(p.uri))?.uri ?? null) : null;
      if (p.foundBy || !canRead || !bottles.length) {
        patch(p.key, { cut, pending: false });
        continue;
      }
      // A label too hard to read says so; a read that couldn't run at all just asks.
      let unclear = true;
      const read = await readBottlePhoto({ uri: p.uri, mimeType: p.mimeType }).then(
        (r) => r[0] ?? null,
        (e: Error) => {
          if (!/read a label/i.test(e.message)) canRead = unclear = false;
          return null;
        },
      );
      const match = read ? matchName(read.name, bottles) : null;
      // A label that fits none keeps the file name's few to ask between.
      patch(p.key, { cut, pending: false, ...(match && 'sure' in match ? { bottleId: match.sure, foundBy: 'label' as const } : { ask: match ? match.ask : p.ask, unclear }) });
    }
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
      setPhotos([]);
      setChosen({});
      setName(null);
    },
  };
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
