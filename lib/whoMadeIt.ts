/**
 * "Who made it" on the add-drink wizard (board w2-wizard-steps, Q24): one
 * list of people instead of Made by and Made with. The draft keeps its two
 * fields, so nothing changes in the database: you, when you're on the list,
 * are saved as the maker (your credit needs no yes), else the first person
 * added; everyone else is saved as made with. The drink page names them all
 * equally, so the order never shows.
 */
import { joinNames, type CreditProfile } from './lineage';
import type { CreditPick, WizardDraft } from './drinkWizard';

/**
 * A credit's status (item_credits.status): named and nobody has answered,
 * waiting for their yes, yes, checked by a moderator, no (it sticks, hidden),
 * or said to be wrong by the one it names (shown, flagged).
 */
export type CreditState = 'suggested' | 'pending' | 'accepted' | 'verified' | 'declined' | 'disputed';

/** The statuses everyone who reads the drink sees. */
export const SHOWN_CREDITS: CreditState[] = ['suggested', 'accepted', 'verified', 'disputed'];

/**
 * One credit on a drink (public.item_credits), with the page it names: the
 * lead creator (a page, sort_order 0) and names with no page (1 to 5),
 * co-creators, the bar it was first made at, and who made its ice or glass.
 * Waiting and declined ones come back only to the one named, the drink's
 * editors and moderators.
 */
export interface ItemCredit {
  id: string;
  role: 'creator' | 'co_creator' | 'bar' | 'maker';
  what: string;
  profile_id: string | null;
  name: string | null;
  sort_order: number;
  status: CreditState;
  disputed_at: string | null;
  dispute_note: string | null;
  profile: CreditProfile | null;
}

type Credited = { credits?: readonly ItemCredit[] | null };

/** The lead creator's credit (a page, first), unless they said no. */
export function leadCredit(credits: readonly ItemCredit[] | null | undefined): ItemCredit | undefined {
  return credits?.find((c) => c.role === 'creator' && !!c.profile_id && c.status !== 'declined');
}

/** Makers with no page, by name ("Harry Craddock"), in the order given. */
export function creditNames(credits: readonly ItemCredit[] | null | undefined): string[] {
  return (credits ?? [])
    .filter((c) => c.role === 'creator' && !!c.name && c.status !== 'declined')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => c.name!);
}

/** One maker's name for a row or a poster ("Jo Park"): the lead creator with a page, else the first named one. */
export function makerName(credits: readonly ItemCredit[] | null | undefined): string | null {
  return leadCredit(credits)?.profile?.display_name ?? creditNames(credits)[0] ?? null;
}

/** A co-creator's answer as the credit reads it: waiting, said no, or yes (a moderator's check or a dispute still shows it). */
export function coAnswer(status: CreditState): 'pending' | 'accepted' | 'declined' {
  return status === 'pending' || status === 'declined' ? status : 'accepted';
}

const coCredits = (d: Credited) => (d.credits ?? []).filter((c): c is ItemCredit & { profile: CreditProfile } => c.role === 'co_creator' && !!c.profile);

export type Credits = Pick<WizardDraft, 'creator' | 'coCreators'>;
type Me = { id: string; name: string } | null;

export interface Maker extends CreditPick {
  me: boolean;
}

const same = (a: CreditPick, b: CreditPick) => (a.id && b.id ? a.id === b.id : a.name === b.name);

/** Everyone on the list, the maker first. Not chosen yet means you, when you have a profile. */
export function makers(d: Credits, me: Me): Maker[] {
  const first: Maker | null =
    d.creator === 'nobody' ? null : d.creator === null || d.creator === 'me' ? (me ? { ...me, me: true } : null) : { ...d.creator, me: !!me && d.creator.id === me.id };
  const rest = d.coCreators.filter((c) => !first || !same(c, first)).map((c) => ({ ...c, me: !!me && c.id === me.id }));
  return first ? [first, ...rest] : rest;
}

/** Add someone from the search. You go first, so your own credit never waits; anyone else joins the end. */
export function addMaker(d: Credits, me: Me, person: CreditPick): Partial<WizardDraft> {
  const list = makers(d, me);
  if (list.some((m) => same(m, person))) return {};
  if (me && person.id === me.id) return { creator: 'me', coCreators: list.map(toPick) };
  if (!list.length) return { creator: person, coCreators: [] };
  return { coCreators: [...d.coCreators, person] };
}

/** Take someone off. The next on the list becomes the maker; take everyone off and it saves as Not sure. */
export function removeMaker(d: Credits, me: Me, person: CreditPick): Partial<WizardDraft> {
  const left = makers(d, me).filter((m) => !same(m, person));
  if (!left.length) return { creator: 'nobody', coCreators: [] };
  const [first, ...rest] = left;
  return { creator: first.me ? 'me' : toPick(first), coCreators: rest.map(toPick) };
}

/** The people saved as made with: each is asked first (a co-creator's credit waits for their yes, #899), unless it's you. */
export function asked(d: Credits, me: Me): Maker[] {
  return makers(d, me).slice(1).filter((m) => !m.me && !!m.id);
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * Under the list (board w3-credits-to-check): "We'll ask Sam first. Sam's
 * name shows on the drink once Sam says yes." Someone whose page nobody has
 * claimed waits for that too.
 */
export function askLines(people: readonly Maker[]): string[] {
  const claimed = people.filter((p) => p.claimed !== false).map((p) => firstName(p.name));
  const lines: string[] = [];
  if (claimed.length === 1) lines.push(`We’ll ask ${claimed[0]} first. ${claimed[0]}’s name shows on the drink once ${claimed[0]} says yes.`);
  else if (claimed.length) lines.push(`We’ll ask ${joinNames(claimed)} first. Each name shows on the drink once they say yes.`);
  for (const p of people.filter((x) => x.claimed === false)) {
    const n = firstName(p.name);
    lines.push(`${n}’s page isn’t claimed yet. The credit waits there until ${n} claims it and says yes.`);
  }
  return lines;
}

/** Review's Credits row (board w3-credits-to-check): "We'll ask Sam first." */
export function askShort(people: readonly Maker[]): string | null {
  return people.length ? `We’ll ask ${joinNames(people.map((p) => firstName(p.name)))} first.` : null;
}

/** People added by name with no page (Eddie, tf-063): saved as credits by name, shown in the credit without a link. */
export function namedOnly(d: Credits): string[] {
  return [...new Set(makers(d, null).filter((m) => !m.id).map((m) => m.name.trim()).filter(Boolean))].slice(0, MAX_NAMED);
}

/** A drink names up to five with no page. */
export const MAX_NAMED = 5;

/**
 * A saved drink's credit as Who made it reads it, for the drink editor: its
 * creator, then everyone made with it who hasn't said Not me, then the names
 * with no page. Nobody credited is Not sure.
 */
export function savedCredits(d: Credited): Credits {
  const lead = leadCredit(d.credits)?.profile;
  const profiles: CreditPick[] = coCredits(d)
    .filter((c) => c.status !== 'declined')
    .map((c) => ({ id: c.profile.id, name: c.profile.display_name }));
  const names: CreditPick[] = creditNames(d.credits).map((name) => ({ id: null, name, sub: BY_NAME }));
  const [first, ...rest] = [...(lead ? [{ id: lead.id, name: lead.display_name }] : []), ...profiles, ...names];
  return first ? { creator: first, coCreators: rest } : { creator: 'nobody', coCreators: [] };
}

/** Under a name with no page, on the list. */
export const BY_NAME = 'By name, no page';

/** A saved drink's credit as it is in the database: the creator's page, the names with no page, and each made-with row. */
export interface SavedCredit {
  creator: string | null;
  names: string[];
  rows: { id: string; status: 'pending' | 'accepted' | 'declined' }[];
}

/** What one change in the editor's Who made it writes (public.set_drink_credits). */
export interface CreditEdit {
  creator: string | null;
  names: string[];
  add: string[];
  remove: string[];
}

export function savedCredit(d: Credited): SavedCredit {
  return {
    creator: leadCredit(d.credits)?.profile?.id ?? null,
    names: creditNames(d.credits),
    rows: coCredits(d).map((c) => ({ id: c.profile.id, status: coAnswer(c.status) })),
  };
}

const keep = (s: SavedCredit, change: Partial<CreditEdit>): CreditEdit => ({ creator: s.creator, names: s.names, add: [], remove: [], ...change });

/**
 * Adding someone in the drink editor (tf-063): never in the creator's place.
 * Someone with a page is made with, asked first like any credit; a name with
 * no page joins the names. Nothing when they're on it already (a declined
 * row included: only that person can change it) or the names are full.
 */
export function editorAdd(s: SavedCredit, person: CreditPick): CreditEdit | null {
  if (person.id) return person.id === s.creator || s.rows.some((r) => r.id === person.id) ? null : keep(s, { add: [person.id] });
  const name = person.name.trim();
  if (!name || s.names.includes(name) || s.names.length >= MAX_NAMED) return null;
  return keep(s, { names: [...s.names, name] });
}

/**
 * Taking someone off in the drink editor. The creator's place goes to the
 * first person made with it who said yes, else to nobody; never to someone
 * still waiting or who said Not me. A declined row is never taken off.
 */
export function editorRemove(s: SavedCredit, person: CreditPick): CreditEdit | null {
  if (!person.id) return s.names.includes(person.name) ? keep(s, { names: s.names.filter((n) => n !== person.name) }) : null;
  if (person.id === s.creator) {
    const next = s.rows.find((r) => r.status === 'accepted');
    return keep(s, { creator: next?.id ?? null, remove: next ? [next.id] : [] });
  }
  return s.rows.some((r) => r.id === person.id && r.status !== 'declined') ? keep(s, { remove: [person.id] }) : null;
}

function toPick(m: Maker): CreditPick {
  const { me: _me, ...pick } = m;
  return pick;
}
