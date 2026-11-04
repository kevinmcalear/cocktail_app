import { useEffect, useMemo, useState } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useBatchLogs } from '@/hooks/useBatches';
import { useFirstRound } from '@/hooks/useFirstRound';
import { usePrepData } from '@/hooks/usePrepList';
import { useShifts } from '@/hooks/useRota';
import { useTonight, type TonightRow } from '@/hooks/useTonight';
import { firstName, nextShift, readProgress, rotaLine, roundSetter, shiftDay } from '@/lib/staffRound';

/** Admin: who "set these" (lib/firstRound roundSetter). */
const ADMIN = 40;
/** How far ahead the rota is read for your next shift. */
const AHEAD = 14 * 86_400_000;

/**
 * "Your first round" at a bar (board Kept-onboard), from the one-home hooks
 * Tonight already loads: tonight's lead menu and its drinks in running order,
 * the house-made they use (Prep's own rule), your batches, the team and the
 * rota. Log a batch is done the moment the bar has one of yours.
 */
export function useStaffRound(barId: string | null) {
  const round = useFirstRound();
  const me = useUserId();
  const { blocks, menus, isLoading } = useTonight(barId);
  const lead = blocks[0] ?? null;
  const drinks = useMemo(() => {
    const all = (lead?.sections ?? []).flatMap((s) => s.drinks);
    return all.filter((d, i) => all.findIndex((x) => x.id === d.id) === i);
  }, [lead]);
  const ids = useMemo(() => drinks.map((d) => d.id), [drinks]);

  // The house-made tonight's drinks use, in the order they come up, with their names from the lines.
  const prepQuery = usePrepData(barId, menus.map((m) => m.id));
  const prep = prepQuery.data;
  const houseMade = useMemo(() => {
    const seen = new Map<string, string>();
    for (const line of (prep?.drinks ?? []).flatMap((d) => d.recipe)) {
      if (prep?.houseMade[line.ingredientId] && !seen.has(line.ingredientId)) seen.set(line.ingredientId, line.name);
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [prep]);

  const batches = useBatchLogs(barId).data;
  const logged = !!me && !!batches?.some((b) => b.madeBy === me);
  const { active, current, done } = round;
  useEffect(() => {
    if (logged && active) done('log_batch');
  }, [logged, active, done]);

  const members = useBarMembers(barId).data ?? [];
  const nameOf = (id: string) => firstName(members.find((m) => m.user_id === id)?.display_name ?? 'Someone');
  const setter = roundSetter(members, me, ADMIN);

  const [now] = useState(() => Date.now());
  const shifts = useShifts(barId, new Date(now).toISOString(), new Date(now + AHEAD).toISOString()).data ?? [];
  const shift = nextShift(shifts, me, now);

  const progress = readProgress(round.round, ids);
  const houseMadeIds = houseMade.map((h) => h.id);
  return {
    ...round,
    /** Tonight and its house-made: until both are in, an empty list means nothing yet. */
    isLoading: isLoading || prepQuery.isLoading,
    menuName: lead?.menu.name ?? null,
    drinks,
    ids,
    /** How many of tonight's drinks are read, and the next one to read. */
    progress,
    houseMade,
    nextHouseMade: readProgress(round.round, houseMadeIds).next,
    setter,
    shift,
    day: shift ? shiftDay(shift.mine.starts_at, new Date(now)) : null,
    rota: shift ? rotaLine(shift, nameOf) : null,
    stepUp: current?.key ?? null,
    /** Marks a drink read; the last one does Read tonight's menu. */
    readDrink: (id: string) => round.read(id, { menu: ids }),
    /** Marks a house-made read; the last one does Learn the house-made. */
    readHouseMade: (id: string) => round.read(id, { houseMade: houseMadeIds }),
  };
}

export type StaffRound = ReturnType<typeof useStaffRound>;
export type RoundDrink = TonightRow;
