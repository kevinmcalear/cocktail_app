// Who is looking at a menu page, and what that adds to it (2027 canvas,
// page Menus, "The menu by who is looking", decided 30 Oct): one page for
// every role, more on it as the role rises, from the capabilities a role
// has (lib/roleMatrix), never from its name.

import type { ListRowState } from '@/lib/listRows';

/** guest: names, what's in each, prices. employee: allergens and talking points. bartender: the method, specs in place. creator: Edit, cost per row. admin: plus the bar page and End. home: your own night. */
export type MenuLens = 'guest' | 'employee' | 'bartender' | 'creator' | 'admin' | 'home';

const ADMIN_LEVEL = 40;

/** The lens for a venue menu from the viewer's capabilities there, or a home menu by whose it is. */
export function menuLens({ barId, caps, roleLevel, mine }: { barId: string | null; caps: readonly string[] | null | undefined; roleLevel: number | null | undefined; mine: boolean }): MenuLens {
  if (!barId) return mine ? 'home' : 'guest';
  const has = (c: string) => !!caps?.includes(c);
  if (has('menus')) return (roleLevel ?? 0) >= ADMIN_LEVEL ? 'admin' : 'creator';
  if (has('specs')) return 'bartender';
  if (has('talking_points')) return 'employee';
  return 'guest';
}

/** Staff of the bar see the menu's tag ("On now") before its eyebrow, and its "since" date. */
export const isStaffLens = (lens: MenuLens) => lens === 'employee' || lens === 'bartender' || lens === 'creator' || lens === 'admin';

/** Who makes menus: Edit, the cost on each row, a list's planned and waiting drinks. */
export const isMenuTeam = (lens: MenuLens) => lens === 'creator' || lens === 'admin';

/** A bartender's row line: "Stirred · Nick & Nora · olive on a pick". */
export function methodLine(methods: readonly string[], glass: string | null | undefined, garnish: string | null | undefined): string {
  return [methods.join(', '), glass, garnish].map((p) => p?.trim()).filter(Boolean).join(' · ');
}

/** A team member's mark on a living-list row that isn't simply on: when it goes on or comes off, or that it waits. */
export function rowStateMark(state: ListRowState, onFrom: string | null, offAt: string | null, day: (iso: string) => string): string | null {
  if (state === 'coming') return onFrom ? `On from ${day(onFrom)}` : 'Coming';
  if (state === 'going') return offAt ? `Off from ${day(offAt)}` : 'Coming off';
  if (state === 'waiting_on') return 'Waiting to go on';
  if (state === 'waiting_off') return 'Waiting to come off';
  return null;
}

/** "Egg in 1 drink" for a guest's allergy line; null when nothing on the menu has theirs. */
export function allergyLine(labels: readonly string[], drinks: number): string | null {
  if (!labels.length || !drinks) return null;
  return `${labels.join(', ')} in ${drinks} ${drinks === 1 ? 'drink' : 'drinks'}`;
}

/** The employee's top line: "Egg in 1 · sulphites in 2". */
export function allergenSummary(counts: ReadonlyMap<string, number>): string {
  if (!counts.size) return 'None on this menu';
  return [...counts]
    .map(([label, n], i) => `${i ? label.toLowerCase() : label} in ${n}`)
    .join(' · ');
}
