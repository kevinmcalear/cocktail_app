import type { MenuDetail } from '@/types/menus';

import type { GroupAction, ModelGroupRow } from './menuPageModel';

// Apart from menuPageModel, which the guest's page loads too: only the signed-in menu page splits its group block.

/**
 * The group block holds only the rows the board draws for the person looking; the rest go into the More sheet
 * (opened from On), never under the drinks: an Admin's Run sheet (Menu-who-admin draws On, Costing, bar page,
 * End), and on a living list (Menu-l-*, which draws On, Last change, Team, Costing) the run sheet and End. An Admin's
 * bar page row stays on the page either way: Menu-who-admin draws it under Costing (board note: the Creator's page plus
 * On the bar page and End this menu).
 */
export function splitGroup(rows: ModelGroupRow[], living: boolean, admin: boolean): [top: ModelGroupRow[], more: ModelGroupRow[]] {
  const off = (r: ModelGroupRow) => (r.action === 'runSheet' ? admin || living : living && r.action === 'end');
  return [rows.filter((r) => !off(r)), rows.filter(off)];
}

/** Those rows as More's buttons. End is More's own Take it off now; the bar page row says what tapping it does. */
export function moreExtras(rows: ModelGroupRow[], menu: Pick<MenuDetail, 'hiddenAt'>, actions: Record<Exclude<GroupAction, null>, () => void>): { label: string; onPress: () => void }[] {
  return rows
    .filter((r) => r.action && r.action !== 'end')
    .map((r) => ({ label: r.action === 'barPage' ? (menu.hiddenAt ? 'Show on the bar page' : 'Hide from the bar page') : r.label, onPress: actions[r.action!] }));
}
