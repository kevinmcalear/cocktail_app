import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useSpecCatalog, useVenueBottle } from '@/hooks/useBulk';
import { useShelf, useShelfEdit } from '@/hooks/useHomeBar';
import { matchIngredient, matchKey, type CatalogItem, type Match } from '@/lib/match';
import { readBottlePhoto, type BottlePhoto, type BottleReading } from '@/lib/readBottle';

/** Where the bottles go: your own shelf, or a venue's ingredients. */
export type BottleTarget = { kind: 'home' } | { kind: 'venue'; barId: string; name: string; canEdit: boolean };

export type BottleState =
  | { status: 'adding' }
  /** `created`: a venue item this sheet made, so Undo deletes it. */
  | { status: 'added'; item: CatalogItem; created: boolean }
  | { status: 'already'; item: CatalogItem }
  | { status: 'open' }
  | { status: 'failed'; message: string };

export interface BottleRow {
  reading: BottleReading;
  match: Match;
  state: BottleState;
}

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Reads a bottle photo and puts what it finds where `target` says: a sure
 * match goes straight in, anything else waits for a pick. Undo takes it back.
 */
export function useBottlePhoto(target: BottleTarget) {
  const venueId = target.kind === 'venue' ? target.barId : null;
  const { catalog, aliases, isLoading } = useSpecCatalog();
  const { data: shelf } = useShelf();
  const home = useShelfEdit();
  const venue = useVenueBottle(venueId);
  const read = useMutation({ mutationFn: readBottlePhoto, onError: () => {} });
  const [photo, setPhoto] = useState<BottlePhoto | null>(null);
  const [rows, setRows] = useState<BottleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Which photo the rows belong to, so a slow add can't land on a newer photo's rows.
  const run = useRef(0);

  const setState = (at: number, i: number, state: BottleState) => {
    if (run.current === at) setRows((prev) => prev.map((row, j) => (j === i ? { ...row, state } : row)));
  };

  /** What's already there for this item, if anything. */
  const existing = (item: CatalogItem): CatalogItem | null => {
    if (target.kind === 'home') return shelf?.includes(item.id) ? item : null;
    if (item.barId === venueId) return item;
    const key = matchKey(item.name);
    return catalog.find((c) => c.barId === venueId && (c.genericId === item.id || matchKey(c.name) === key)) ?? null;
  };

  /** Adds the item (or, with null, the label as a new venue ingredient). */
  const add = async (at: number, i: number, reading: BottleReading, item: CatalogItem | null, kindId: string | null = null) => {
    const have = item && existing(item);
    if (have) return setState(at, i, { status: 'already', item: have });
    setState(at, i, { status: 'adding' });
    try {
      if (target.kind === 'home') {
        if (!item) return;
        await home.add.mutateAsync(item.id);
        return setState(at, i, { status: 'added', item, created: false });
      }
      const name = item?.name ?? reading.name;
      // A venue's copy keeps the shared bottle's name, so it has to say it's a version of that bottle
      // (guard_ingredient_name, 20261008100000); specs that call for the shared one still find it.
      const id = await venue.add.mutateAsync({ name, genericId: item ? item.id : kindId, brand: reading.brand, abv: reading.abv });
      setState(at, i, { status: 'added', item: { id, name, genericId: null, barId: venueId }, created: true });
    } catch (e) {
      setState(at, i, { status: 'failed', message: message(e, 'Couldn’t add that bottle.') });
    }
  };

  const undo = async (i: number) => {
    const row = rows[i];
    if (row?.state.status !== 'added') return;
    const at = run.current;
    const { item, created } = row.state;
    setState(at, i, { status: 'adding' });
    try {
      if (target.kind === 'home') await home.remove.mutateAsync(item.id);
      else if (created) await venue.remove.mutateAsync(item.id);
      setState(at, i, { status: 'open' });
    } catch (e) {
      setState(at, i, { status: 'failed', message: message(e, 'Couldn’t undo that.') });
    }
  };

  const readPhoto = async (next: BottlePhoto) => {
    const at = ++run.current;
    setPhoto(next);
    setRows([]);
    setError(null);
    try {
      const bottles = await read.mutateAsync(next);
      if (run.current !== at) return;
      const found = bottles.map((reading) => ({ reading, match: matchIngredient(reading, catalog, venueId, aliases), state: { status: 'open' } as BottleState }));
      setRows(found);
      // Sure matches go straight in; venues only when the person can edit there.
      if (target.kind === 'venue' && !target.canEdit) return;
      const taken = new Set<string>();
      found.forEach((row, i) => {
        if (row.match.kind !== 'one') return;
        const { item } = row.match;
        // Two labels for one catalog bottle: the second is already there.
        if (taken.has(item.id)) return setState(at, i, { status: 'already', item });
        taken.add(item.id);
        void add(at, i, row.reading, item);
      });
    } catch (e) {
      if (run.current === at) setError(message(e, 'Couldn’t read that photo. Try again.'));
    }
  };

  return {
    photo,
    rows,
    error,
    reading: read.isPending,
    catalogLoading: isLoading,
    readPhoto,
    retry: () => (photo ? void readPhoto(photo) : undefined),
    pick: (i: number, item: CatalogItem | null, kindId?: string | null) => {
      const row = rows[i];
      if (row) void add(run.current, i, row.reading, item, kindId ?? null);
    },
    undo: (i: number) => void undo(i),
    fail: setError,
    reset: () => {
      run.current += 1;
      setPhoto(null);
      setRows([]);
      setError(null);
    },
  };
}
