import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sortRiffs, styleChain, type CreditStatus, type DrinkStyle, type LineageDrink } from '@/lib/lineage';
import { jsonAs, supabase } from '@/lib/supabase';
import { coAnswer, creditNames, leadCredit, type CreditEdit, type ItemCredit } from '@/lib/whoMadeIt';

// The credits aren't in app_item_presentation, so these read items and
// item_credits directly; their RLS policies apply the same visibility rules.
export const PROFILE_COLUMNS = 'id, kind, handle, display_name, avatar_url, locality, is_closed, closed_year';
/** A drink's credits, each with the page it names (item_credits). */
export const CREDIT_COLUMNS = `credits:item_credits(id, role, what, profile_id, name, sort_order, status, disputed_at, dispute_note, profile:profiles(${PROFILE_COLUMNS}))`;
export const LINEAGE_COLUMNS = `id, name, based_on_id, based_on_kind, based_on_style_id, origin_year, origin_year_approx, origin_year_guess, origin,
  is_catalog, lineage_note,
  origin_bar:profiles!items_origin_bar_profile_id_fkey(${PROFILE_COLUMNS}),
  ${CREDIT_COLUMNS}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STYLE_COLUMNS = 'id, key, name, family, parent_style_id, year, year_approx, summary';

/** What a drink is based on: a drink made from another, a classic that came from another classic, or a classic straight from a historic style. */
export type BasedOnKind = 'riff' | 'descends' | 'style';

/** A drink as LINEAGE_COLUMNS reads it: its one based-on link and its credits. */
export interface LineageRow {
  id: string;
  name: string;
  based_on_id: string | null;
  based_on_kind: BasedOnKind | null;
  /** A classic straight from a historic style (drink_styles). */
  based_on_style_id: string | null;
  origin_year: number | null;
  origin_year_approx?: boolean | null;
  origin_year_guess?: string | null;
  origin: string | null;
  is_catalog?: boolean | null;
  lineage_note?: string | null;
  origin_bar: LineageDrink['origin_bar'];
  credits: ItemCredit[];
}

export type LineageItem = LineageDrink & LineageRow;

/** The line's status in the old three words: the lead creator's, or the first bar's when there's none. */
function lineStatus(credits: readonly ItemCredit[]): CreditStatus | null {
  const main = leadCredit(credits) ?? credits.find((c) => c.role === 'bar' && c.status !== 'declined');
  if (!main) return null;
  return main.status === 'accepted' ? 'claimed' : main.status === 'verified' ? 'verified' : 'suggested';
}

/**
 * ponytail: lib/lineage.ts still reads a drink's credit and parent by the
 * names LineageDrink declares; this fills them from item_credits and
 * based_on_*. It goes when lib/lineage.ts reads `credits` and `based_on_*`.
 */
export function asLineage<T extends LineageRow>(row: T): T & LineageDrink {
  const credits = row.credits ?? [];
  return {
    ...row,
    credits,
    riff_of_id: row.based_on_kind === 'riff' ? row.based_on_id : null,
    lineage_parent_id: row.based_on_kind === 'descends' ? row.based_on_id : null,
    credit_status: lineStatus(credits),
    creator: leadCredit(credits)?.profile ?? null,
    co_creators: credits.filter((c) => c.role === 'co_creator').map((c) => ({ status: coAnswer(c.status), profile: c.profile })),
    creator_names: creditNames(credits),
  };
}

/**
 * Drinks based on this one as `kind`, best-credited first, up to `limit`. A
 * credit's status is in item_credits, which can't order the drinks, so the
 * ones whose lead or first bar said yes (or a moderator checked) are read
 * apart and lead, then the rest by name.
 */
export async function fetchBasedOn(id: string, kind: BasedOnKind, limit: number): Promise<LineageItem[]> {
  const basedOn = (columns: string) => supabase.from('items').select(columns).eq('based_on_id', id).eq('based_on_kind', kind);
  const [sure, rest] = await Promise.all([
    basedOn(`${LINEAGE_COLUMNS}, sure:item_credits!inner(id)`).in('sure.role', ['creator', 'bar']).in('sure.status', ['accepted', 'verified']).order('name').limit(limit),
    basedOn(LINEAGE_COLUMNS).order('name').limit(limit),
  ]);
  if (sure.error) throw sure.error;
  if (rest.error) throw rest.error;
  const rows = [...((sure.data ?? []) as unknown as LineageRow[]), ...((rest.data ?? []) as unknown as LineageRow[])];
  const once = rows.filter((r, i) => rows.findIndex((s) => s.id === r.id) === i);
  return sortRiffs(once.map(asLineage)).slice(0, limit);
}

/** Every historic style (about 25 rows), for family trees. */
export async function fetchStyles(): Promise<DrinkStyle[]> {
  const { data, error } = await supabase.from('drink_styles').select(STYLE_COLUMNS);
  if (error) throw error;
  return data ?? [];
}

export interface Lineage {
  drink: LineageItem | null;
  /** Root first; the last one is what this drink is a riff of. */
  ancestors: LineageItem[];
  /** The historic styles above the oldest drink, oldest first (Punch, Sour). */
  styles: DrinkStyle[];
  /** Classics that came from this one (Penicillin under Gold Rush). */
  classics: LineageItem[];
  /** Bars' versions and riffs on it, best-credited first. */
  riffs: LineageItem[];
}

/** drink_lineage's answer: each drink in LINEAGE_COLUMNS' shape. */
interface LineageRpc {
  drink: LineageRow | null;
  ancestors: LineageRow[];
  classics: LineageRow[];
  riffs: LineageRow[];
  /** Every historic style when the oldest drink comes from one, else none. */
  styles: DrinkStyle[];
}

/**
 * A drink's family: its credit, what it's a riff of up to the first classic,
 * the styles above that, and what came from it, in one request
 * (public.drink_lineage, which reads as the caller, so drinks the reader
 * can't see are left out). It used to take 5 to 16 requests a page.
 */
export function useLineage(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['lineage', itemId],
    // Only a real uuid reaches the server (dev ids like "dev" would 400).
    enabled: !!itemId && UUID.test(itemId),
    queryFn: async (): Promise<Lineage> => {
      const { data, error } = await supabase.rpc('drink_lineage', { p_item_id: itemId! });
      if (error) throw error;
      const res = jsonAs<LineageRpc>(data);
      const drink = res.drink ? asLineage(res.drink) : null;
      const ancestors = drink ? res.ancestors.map(asLineage) : [];
      const oldest = ancestors[0] ?? drink;
      return {
        drink,
        ancestors,
        styles: oldest?.based_on_style_id ? styleChain(oldest.based_on_style_id, res.styles) : [],
        classics: res.classics.map(asLineage).sort((a, b) => (a.origin_year ?? 9999) - (b.origin_year ?? 9999)),
        // The 100 best-credited versions, sure ones first; page them if a list needs more.
        riffs: sortRiffs(res.riffs.map(asLineage)).slice(0, 100),
      };
    },
  });
}

export type CreditDrink = LineageItem & {
  /** The drink it's based on (a riff's drink, a classic's parent); null for a style or none. */
  based_on: Pick<LineageDrink, 'id' | 'name' | 'is_catalog'> | null;
};

/**
 * Just what the line under a drink's name needs, in one request: its credit
 * and the drink it comes from. Separate from useLineage, whose walk up the
 * tree takes a request per ancestor, so the line arrives with the page.
 */
export function useDrinkCredit(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['drink-credit', itemId],
    enabled: !!itemId && UUID.test(itemId),
    queryFn: async (): Promise<CreditDrink | null> => {
      const { data, error } = await supabase
        .from('items')
        .select(`${LINEAGE_COLUMNS}, based_on:based_on_id(id, name, is_catalog)`)
        .eq('id', itemId!)
        .maybeSingle();
      if (error) throw error;
      // ponytail: supabase-js can't type an embed on items' own foreign keys ("more than one relationship"), so the row is cast.
      return data ? asLineage(data as unknown as LineageRow & Pick<CreditDrink, 'based_on'>) : null;
    },
  });
}

/**
 * Saves one change to a saved drink's Who made it (drink editor, tf-063) in
 * one call, all or nothing (public.set_drink_credits): the creator and the
 * names with no page, then the made-with rows to take off and add (each
 * asked first, as from the wizard).
 */
export function useSetDrinkCredits(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (w: CreditEdit) => {
      const { error } = await supabase.rpc('set_drink_credits', {
        p_item_id: itemId,
        // Null is nobody; the generated types don't say a uuid argument can be null.
        p_creator_profile_id: w.creator as string,
        p_creator_names: w.names,
        p_add: w.add,
        p_remove: w.remove,
      });
      if (error) throw error;
    },
    // Pending until the credit is read again, so the next change starts from what was saved.
    // Everywhere the credit shows: a person's drinks and the signed-out page too.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['drink-credit', itemId] }),
        qc.invalidateQueries({ queryKey: ['lineage', itemId] }),
        qc.invalidateQueries({ queryKey: ['profile-originals'] }),
        qc.invalidateQueries({ queryKey: ['published', 'drink', itemId] }),
        qc.invalidateQueries({ queryKey: ['published', 'drink-more', itemId] }),
      ]),
  });
}
