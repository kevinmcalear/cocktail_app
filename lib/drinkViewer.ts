/**
 * Who is looking at a drink page, which decides what it shows (canvas GWBCX,
 * Decided "The drink page by who is looking", 29 Oct). There is no role
 * switcher on the page: the account decides, and View as lives in Settings.
 *
 * guest: what's in it by name, tastes, palate fit, Rank it.
 * floor: allergens first, what's in it, how it goes out. No buttons.
 * public: a spec anyone may read (a classic, a shared home drink): Ingredients first.
 * bartender: Steps first, and the bar's own rows.
 * creator: the bartender's page plus Edit, cost and menus (Drink Creator and Admin).
 * home: a drink in your own bar: Steps first, like a bartender.
 */
export type DrinkViewer = 'guest' | 'floor' | 'public' | 'bartender' | 'creator' | 'home';

export interface ViewerInputs {
  /** Home mode, on a drink with no bar (yours, or a classic). */
  home: boolean;
  /** You made it or may edit it (your own drink at home). */
  own: boolean;
  /** Your role at the drink's bar, in venue mode (View as applied); null when you're not on its team. Below Employee (20) is a guest. */
  teamRole: number | null;
  /** The drink's people may edit it: Edit, and the creator's rows. */
  canEdit: boolean;
  /** Amounts are visible to you (useSpecAccess). */
  amounts: boolean;
}

export function drinkViewer({ home, own, teamRole, canEdit, amounts }: ViewerInputs): DrinkViewer {
  if (home) return own && amounts ? 'home' : amounts ? 'public' : 'guest';
  if (teamRole !== null && teamRole >= 20) {
    if (canEdit && amounts) return 'creator';
    return amounts ? 'bartender' : 'floor';
  }
  return amounts ? 'public' : 'guest';
}

/** People who make the drink open its spec in Steps until they pick otherwise. */
export const makesIt = (v: DrinkViewer) => v === 'bartender' || v === 'creator' || v === 'home';

/** The bar's own team: its rows (Behind the bar) and how it goes out. */
export const onTeam = (v: DrinkViewer) => v === 'floor' || v === 'bartender' || v === 'creator';

/** Names only: no toggle, no amounts, and nothing that hints at what's held back. */
export const namesOnly = (v: DrinkViewer) => v === 'guest' || v === 'floor';
