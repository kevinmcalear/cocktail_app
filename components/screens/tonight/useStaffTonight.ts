import { useEffect, useMemo, useState } from 'react';

import { useBarFacts } from '@/hooks/useBarFacts';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useCreditsToCheck } from '@/hooks/useCreditsToCheck';
import { useGuestDrinkAllergens } from '@/hooks/useGuestAllergies';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePrepData } from '@/hooks/usePrepList';
import { useServiceDate } from '@/hooks/useServiceDay';
import { useTonight, type TonightRow } from '@/hooks/useTonight';
import { useVenueProfileId } from '@/hooks/useVenueRoles';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { hoursStatus } from '@/lib/barHours';
import { groupMenus } from '@/lib/menus';
import { buildPrepList, DEFAULT_SERVES, tonightAt6 } from '@/lib/prep';
import { allergenLabel } from '@/lib/allergens';
import { offTonight, runThroughMinutes, talkThrough, tonightEyebrow } from '@/lib/tonight';

/** Admins see Needs you (Prod-where: "Drink Creator and Admin"). */
const NEEDS_YOU = 35;

/** How often the page's clock moves on. */
const TICK = 5 * 60_000;

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

  // Before doors: the house-made Prep would have you make for tonight.
  const caps = useCapabilities(barId).data;
  const canPrep = Array.isArray(caps) && caps.includes('prep');
  const prepData = usePrepData(canPrep ? barId : null, menus.map((m) => m.id)).data;
  const prep = useMemo(
    () => (prepData ? buildPrepList({ ...prepData, servesPerDrink: DEFAULT_SERVES, startsAt: tonightAt6(), now }) : null),
    [prepData, now]
  );
  const houseMade = prepData ? Object.keys(prepData.houseMade).length : 0;

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
    off,
    learn,
    admin,
    credits,
    next,
  };
}
