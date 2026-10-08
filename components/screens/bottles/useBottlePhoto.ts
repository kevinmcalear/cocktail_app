import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useSpecCatalog, useVenueBottle } from '@/hooks/useBulk';
import { useShelf, useShelfEdit } from '@/hooks/useHomeBar';
import { matchIngredient, matchKey, type CatalogItem, type Match } from '@/lib/match';
import { readBottlePhoto, type BottlePhoto, type BottleReading } from '@/lib/readBottle';

/** Where the bottles go: your own shelf, or a venue's ingredients. */
export type BottleTarget = { kind: 'home' } | { kind: 'venue'; barId: string; name: string; canEdit: boolean };

/** What a row adds when you press Add: a catalog bottle, or (at a venue) the label as a new ingredient of a kind. */
export type BottleChoice = { item: CatalogItem } | { item: null; kindId: string | null };

export type BottleState =
  | { status: 'open' }
  | { status: 'adding' }
  /** `created`: a venue item this sheet made, so Undo deletes it. */
  | { status: 'added'; item: CatalogItem; created: boolean }
  | { status: 'already'; item: CatalogItem }
  | { status: 'failed'; message: string };

export interface BottleRow {
  reading: BottleReading;
  match: Match;
  state: BottleState;
  /** Ticked to add. Sure matches start ticked; nothing is added until Add. */
  chosen: BottleChoice | null;
}

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const waiting = (row: BottleRow) => row.state.status === 'open' || row.state.status === 'failed';

/**
 * Reads a bottle photo (or takes labels Bring in already read) and shows what
 * it found: sure matches ticked, the rest waiting for a pick. Add puts the
 * ticked ones where `target` says; Undo takes one back.
 */
export function useBottlePhoto(target: BottleTarget) {
  const venueId = target.kind === 'venue' ? target.barId : null;
  const locked = target.kind === 'venue' && !target.canEdit;
  const { catalog, aliases, isLoading } = useSpecCatalog();
  const { data: shelf } = useShelf();
  const home = useShelfEdit();
  const venue = useVenueBottle(venueId);
  const read = useMutation({ mutationFn: readBottlePhoto, onError: () => {} });
  const [photo, setPhoto] = useState<BottlePhoto | null>(null);
  const [rows, setRows] = useState<BottleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Which photo the rows belong to, so a slow add can't land on a newer photo's rows.
  const run = useRef(0);

  const update = (at: number, i: number, change: Partial<BottleRow>) => {
    if (run.current === at) setRows((prev) => prev.map((row, j) => (j === i ? { ...row, ...change } : row)));
  };

  /** What's already there for this item, if anything. */
  const existing = (item: CatalogItem): CatalogItem | null => {
    if (target.kind === 'home') return shelf?.includes(item.id) ? item : null;
    if (item.barId === venueId) return item;
    const key = matchKey(item.name);
    return catalog.find((c) => c.barId === venueId && (c.genericId === item.id || matchKey(c.name) === key)) ?? null;
  };

  /** Rows for these labels: already there, ticked when sure, else waiting. */
  const place = (readings: BottleReading[]) => {
    const at = ++run.current;
    const taken = new Set<string>();
    setError(null);
    setRows(
      readings.map((reading) => {
        const match = matchIngredient(reading, catalog, venueId, aliases);
        const row: BottleRow = { reading, match, state: { status: 'open' }, chosen: null };
        if (match.kind !== 'one') return row;
        const have = existing(match.item);
        // Two labels for one catalog bottle: the second is already there.
        if (have || taken.has(match.item.id)) return { ...row, state: { status: 'already', item: have ?? match.item } };
        taken.add(match.item.id);
        return locked ? row : { ...row, chosen: { item: match.item } };
      }),
    );
    return at;
  };

  const addOne = async (at: number, i: number, row: BottleRow) => {
    const choice = row.chosen;
    if (!choice) return;
    const have = choice.item && existing(choice.item);
    if (have) return update(at, i, { state: { status: 'already', item: have } });
    update(at, i, { state: { status: 'adding' } });
    try {
      if (target.kind === 'home') {
        if (!choice.item) return update(at, i, { state: { status: 'open' } });
        await home.add.mutateAsync(choice.item.id);
        return update(at, i, { state: { status: 'added', item: choice.item, created: false } });
      }
      const name = choice.item?.name ?? row.reading.name;
      // A venue's copy keeps the shared bottle's name, so it has to say it's a version of that bottle
      // (guard_ingredient_name, 20261008100000); specs that call for the shared one still find it.
      const genericId = choice.item ? choice.item.id : choice.kindId;
      const id = await venue.add.mutateAsync({ name, genericId, brand: row.reading.brand, abv: row.reading.abv });
      update(at, i, { state: { status: 'added', item: { id, name, genericId: null, barId: venueId }, created: true } });
    } catch (e) {
      update(at, i, { state: { status: 'failed', message: message(e, 'Couldn’t add that bottle.') } });
    }
  };

  /** Adds every ticked row, one at a time. */
  const addAll = async () => {
    const at = run.current;
    setAdding(true);
    for (const [i, row] of rows.entries()) if (waiting(row) && row.chosen) await addOne(at, i, row);
    setAdding(false);
  };

  const undo = async (i: number) => {
    const row = rows[i];
    if (row?.state.status !== 'added') return;
    const at = run.current;
    const { item, created } = row.state;
    update(at, i, { state: { status: 'adding' } });
    try {
      if (target.kind === 'home') await home.remove.mutateAsync(item.id);
      else if (created) await venue.remove.mutateAsync(item.id);
      update(at, i, { state: { status: 'open' }, chosen: null });
    } catch (e) {
      update(at, i, { state: { status: 'failed', message: message(e, 'Couldn’t undo that.') } });
    }
  };

  const readPhoto = async (next: BottlePhoto) => {
    const at = ++run.current;
    setPhoto(next);
    setRows([]);
    setError(null);
    try {
      const bottles = await read.mutateAsync(next);
      if (run.current === at) place(bottles);
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
    adding,
    /** How many rows Add would add. */
    ready: rows.filter((row) => waiting(row) && row.chosen).length,
    readPhoto,
    place: (readings: BottleReading[]) => void place(readings),
    retry: () => (photo ? void readPhoto(photo) : undefined),
    choose: (i: number, chosen: BottleChoice | null) => update(run.current, i, { chosen, state: { status: 'open' } }),
    addAll: () => void addAll(),
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
