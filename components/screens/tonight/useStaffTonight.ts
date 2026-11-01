import { useEffect, useMemo, useState } from 'react';

import { useBarFacts } from '@/hooks/useBarFacts';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useCreditsToCheck } from '@/hooks/useCreditsToCheck';
import { useGuestDrinkAllergens } from '@/hooks/useGuestAllergies';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useMenu, useVenueMenus } from '@/hooks/useMenus';
import { useShifts } from '@/hooks/useRota';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useSpecBook } from '@/hooks/useSpecBook';
import { useBarShareOpens } from '@/hooks/useShareSlug';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useUserId } from '@/ctx/AuthContext';
import { usePrepData } from '@/hooks/usePrepList';
import { useServiceDate } from '@/hooks/useServiceDay';
import { useTonight, type TonightRow } from '@/hooks/useTonight';
import { useVenueProfileId } from '@/hooks/useVenueRoles';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { hoursStatus } from '@/lib/barHours';
import { groupMenus, printedPrice } from '@/lib/menus';
import { buildPrepList, DEFAULT_SERVES, tonightAt6 } from '@/lib/prep';
import { allergenLabel } from '@/lib/allergens';
import { formatQuantity } from '@/lib/quantity';
import { nextNight, nightPhase } from '@/lib/nightPhase';
import { serveLine } from '@/lib/specView';
import { enoughRows, garnishOf, offAtLine, recipeNames, offTonight, onShiftLine, runThroughMinutes, serviceEnd, talkAbout, talkThrough, tonightEyebrow, unpriced } from '@/lib/tonight';

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
  // By the hour (Loop-tonight): before doors, during service, after close. The web's static render has no clock.
  const phase = hydrated ? nightPhase(facts?.hours, now, facts?.timezone) : 'before';
  const doors = phase === 'before' && status && !status.open ? status.detail : null;
  const tail = phase === 'service' && status?.open ? status.detail?.replace(/^until /, 'open till ') : phase === 'after' && status ? 'closed' : null;
  const eyebrow = date ? [tonightEyebrow(date, doors), tail].filter(Boolean).join(' · ') : '';

  // Before doors (Prod-today-staff, bartenders up): the house-made Prep would have you make for
  // tonight, and what's counted or logged and enough. Specs is the drink makers' permission.
  const caps = useCapabilities(barId).data;
  const canPrep = Array.isArray(caps) && (caps.includes('prep') || caps.includes('specs'));
  const prepData = usePrepData(canPrep ? barId : null, menus.map((m) => m.id)).data;
  const prep = useMemo(
    () => (prepData ? buildPrepList({ ...prepData, servesPerDrink: DEFAULT_SERVES, startsAt: tonightAt6(), now }) : null),
    [prepData, now]
  );
  const houseMade = prepData ? Object.keys(prepData.houseMade).length : 0;
  // Before doors shows once the bar counts (or logs a batch of) anything: before that it has nothing true to say.
  const counted = !!prepData && Object.keys(prepData.onHand).length > 0;
  const lineNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const line of [...(prepData?.drinks ?? []).flatMap((d) => d.recipe), ...Object.values(prepData?.houseMade ?? {}).flatMap((h) => h.recipe)]) names.set(line.ingredientId, line.name);
    return names;
  }, [prepData]);
  const enough = prepData
    ? enoughRows(Object.keys(prepData.houseMade), prep?.make ?? [], prepData.onHand, (id) => lineNames.get(id), (id) => formatQuantity(prepData.onHand[id]))
    : [];
  /** A house-made's batch, for a one-tap Log batch; null when its recipe doesn't say what it makes. */
  const batchOf = (id: string) => {
    const hm = prepData?.houseMade[id];
    return hm?.yieldAmount && hm.yieldUnit ? { amount: hm.yieldAmount, unit: hm.yieldUnit } : null;
  };

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
  // During service, the lead list's drinks as they go out: "Rocks · Large cube · Candied ginger", "raw egg white, tell guests".
  const book = useSpecBook(phase === 'service' ? barId : null).data;
  const lists = useDropdowns().data;
  const served = useMemo(() => {
    const named = (list: readonly { id: string; name: string }[] | undefined, id: string | null | undefined) => (id ? list?.find((x) => x.id === id)?.name : undefined);
    return new Map((book?.items ?? []).map((i) => [i.id, serveLine([named(lists?.glassware, i.glassware_id), named(lists?.iceTypes, i.ice_id), ...garnishOf(recipeNames(i.recipes))])]));
  }, [book, lists]);
  const lead = blocks[0] ?? null;
  const service = (lead?.sections.flatMap((s) => s.drinks) ?? []).map((d) => {
    const talk = talkAbout(allergens?.get(d.id)?.allergens, allergenLabel);
    const word = talk ? `${talk.word.charAt(0).toLowerCase()}${talk.word.slice(1)}, tell guests` : null;
    // Off once its take-off time has passed; until then it says when it comes off.
    const offAt = off.find((o) => o.id === d.id)?.offAt ?? null;
    const gone = offAt != null && Date.parse(offAt) <= now.getTime();
    return { id: d.id, kind: d.kind, name: d.name, off: gone, sub: gone ? 'Off tonight' : serveLine([served.get(d.id), word, offAt && offAtLine(offAt).replace(/^C/, 'c')]) };
  });
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
  // After close, tomorrow's: the next service day, 6am to 6am.
  const nextEnd = new Date(serviceEnd(now));
  nextEnd.setDate(nextEnd.getDate() + 1);
  const nextShifts = useShifts(phase === 'after' ? barId : null, serviceEnd(now).toISOString(), nextEnd.toISOString()).data ?? [];
  const members = useBarMembers(shifts.length || nextShifts.length ? barId : null).data ?? [];
  const me = useUserId();
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? 'Someone';
  const onShift = onShiftLine(shifts, nameOf, me);
  const tomorrow = phase === 'after' ? { night: date ? nextNight(date) : 'Tomorrow', onShift: onShiftLine(nextShifts, nameOf, me) } : null;
  const writesRota = useCanManageStaff(barId);

  const leadIds = lead ? lead.sections.flatMap((s) => s.drinks.map((d) => d.id)) : [];
  return {
    eyebrow,
    phase,
    isLoading,
    blocks,
    lead,
    heroIds: leadIds.slice(0, 3),
    canPrep,
    counted,
    make: prep?.make ?? null,
    houseMade,
    enough,
    batchOf,
    off,
    service,
    learn,
    admin,
    credits,
    next,
    nextUnpriced,
    shares,
    onShift,
    writesRota,
    tomorrow,
  };
}
