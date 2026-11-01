import { useEffect, useMemo, useState } from 'react';

import { useBarFacts } from '@/hooks/useBarFacts';
import { useCreditsToCheck } from '@/hooks/useCreditsToCheck';
import { useGuestDrinkAllergens } from '@/hooks/useGuestAllergies';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { useShifts } from '@/hooks/useRota';
import { useBarShareOpens } from '@/hooks/useShareSlug';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useUserId } from '@/ctx/AuthContext';
import { useServiceDate } from '@/hooks/useServiceDay';
import { useTonight, type TonightRow } from '@/hooks/useTonight';
import { useTonightPrep } from '@/hooks/useTonightPrep';
import { useVenueProfileId } from '@/hooks/useVenueRoles';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { hoursStatus } from '@/lib/barHours';
import { groupMenus, printedPrice } from '@/lib/menus';
import { allergenLabel } from '@/lib/allergens';
import { formatQuantity } from '@/lib/quantity';
import { enoughRows, offTonight, onShiftLine, runThroughMinutes, serviceEnd, talkThrough, tonightEyebrow, unpriced } from '@/lib/tonight';

/** Admins see Needs you (Prod-where: "Drink Creator and Admin"). */
const NEEDS_YOU = 35;

/** How often the page's clock moves on. */
const TICK = 5 * 60_000;
const HOUR = 3_600_000;

/**
 * Staff Tonight's data, from the one-home hooks: the lists on now (useTonight,
 * which the spec book serves offline), house-made short for tonight (the
 * Prep list's own rule, lib/prep), drinks coming off before 6am, what's new to
 * learn, and for admins what needs them. Nothing here is fetched twice:
 * Prep, Study and the menus page share these queries.
 */
export function useStaffTonight(barId: string) {
  const { menus, blocks, isLoading } = useTonight(barId);
  const date = useServiceDate();
  const hydrated = useIsHydrated();
  // The tab stays mounted all night: the clock moves on so doors, Off tonight and what's next stay true.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), TICK);
    return () => clearInterval(tick);
  }, []);
  const role = useEffectiveRole(barId);

  // Doors: the bar's own hours, when its page has them.
  const profileId = useVenueProfileId(barId).data;
  const facts = useBarFacts(profileId).data;
  const status = hydrated && facts?.hours ? hoursStatus(facts.hours, now, facts.timezone) : null;
  const eyebrow = date ? tonightEyebrow(date, status && !status.open ? status.detail : null) : '';

  // Before doors (Prod-today-staff, bartenders up): the house-made Prep would have you make for
  // tonight, and what's counted or logged and enough (hooks/useTonightPrep.ts, shared with Drinks).
  const { canPrep, prepData, prep, batchOf } = useTonightPrep(barId, menus.map((m) => m.id), now);
  const houseMade = prepData ? Object.keys(prepData.houseMade).length : 0;
  const lineNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const line of [...(prepData?.drinks ?? []).flatMap((d) => d.recipe), ...Object.values(prepData?.houseMade ?? {}).flatMap((h) => h.recipe)]) names.set(line.ingredientId, line.name);
    return names;
  }, [prepData]);
  const enough = prepData
    ? enoughRows(Object.keys(prepData.houseMade), prep?.make ?? [], prepData.onHand, (id) => lineNames.get(id), (id) => formatQuantity(prepData.onHand[id]))
    : [];
  const all = blocks.flatMap((b) => b.sections.flatMap((s) => s.drinks.map((d) => ({ drink: d, list: b.menu.name }))));
  const off: TonightRow[] = offTonight(
    all.map((a) => a.drink),
    now
  );
  // Learn: what's new on the lists tonight, once each.
  const once = all.filter((a, i) => all.findIndex((b) => b.drink.id === a.drink.id) === i);
  // Learn (Prod-today-staff): what's new on the lists, each a short run-through in Study, then one drink's allergen to explain at the table.
  const fresh = once.filter((a) => a.drink.isNew).slice(0, 2);
  const allergens = useGuestDrinkAllergens(once.map((a) => a.drink.id)).data;
  const talk = talkThrough(
    once.map((a) => a.drink),
    (id) => allergens?.get(id)?.allergens,
    allergenLabel
  );
  const learn = [
    ...fresh.map(({ drink, list }) => ({ id: drink.id, kind: drink.kind, name: drink.name, sub: `New on ${list} · a ${runThroughMinutes(drink.line)}-minute run-through`, href: `/study/tonight?drink=${drink.id}` })),
    ...(talk ? [{ ...talk, kind: once.find((a) => a.drink.id === talk.id)!.drink.kind, href: null }] : []),
  ];

  const admin = role >= NEEDS_YOU;
  const credits = useCreditsToCheck().data?.length ?? 0;
  // The same query useTonight reads: no second fetch.
  const venueMenus = useVenueMenus(barId).data;
  const next = useMemo(() => groupMenus((venueMenus ?? []).filter((m) => m.barId === barId), now.getTime()).upcoming[0] ?? null, [venueMenus, barId, now]);
  const nextMenu = useMenu(admin ? next?.id : null).data;
  const nextUnpriced = nextMenu ? unpriced(nextMenu.sections.flatMap((s) => s.drinks), printedPrice) : 0;
  // Shared links this week: the last seven days, to the hour so the key holds still.
  const weekAgo = new Date(Math.floor(now.getTime() / HOUR) * HOUR - 7 * 24 * HOUR).toISOString();
  const shares = useBarShareOpens(admin ? barId : null, weekAgo).data ?? null;

  // On shift: who's on between now and the end of the night.
  const hourNow = new Date(Math.floor(now.getTime() / HOUR) * HOUR).toISOString();
  const shifts = useShifts(barId, hourNow, serviceEnd(now).toISOString()).data ?? [];
  const members = useBarMembers(shifts.length ? barId : null).data ?? [];
  const me = useUserId();
  const onShift = onShiftLine(shifts, (id) => members.find((m) => m.user_id === id)?.display_name ?? 'Someone', me);

  const lead = blocks[0] ?? null;
  const leadIds = lead ? lead.sections.flatMap((s) => s.drinks.map((d) => d.id)) : [];
  return {
    eyebrow,
    isLoading,
    blocks,
    lead,
    heroIds: leadIds.slice(0, 3),
    canPrep,
    make: prep?.make ?? null,
    houseMade,
    enough,
    batchOf,
    off,
    learn,
    admin,
    credits,
    next,
    nextUnpriced,
    shares,
    onShift,
  };
}
