import { useMemo, useState } from 'react';

import { useBarMembers } from '@/hooks/useBarDetail';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useBarPageId } from '@/hooks/useBarGlassware';
import { useMenu } from '@/hooks/useMenus';
import { useRunSheet } from '@/hooks/useRunSheet';
import { useShifts } from '@/hooks/useRota';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { faceFromDb, normalizeHex } from '@/lib/brand';
import { printedPrice } from '@/lib/menus';
import { paperFor, type SheetPaper } from '@/lib/paper/page';
import type { PrintBar, PrintDrink } from '@/lib/paper/print';
import { buildRunSheet, DEFAULT_MARGIN_PCT } from '@/lib/runSheet';
import { onShiftLine, serviceEnd } from '@/lib/tonight';
import { siteOrigin } from '@/lib/venueLink';

export interface PrintSet {
  bar: PrintBar | null;
  menuName: string;
  drinks: PrintDrink[];
  /** Who's on tonight: "Jo, Ana and Theo", or null with no rota. */
  team: string | null;
  date: Date;
  /** Letter or A4, from where the bar is (lib/paper/page paperFor). */
  paper: SheetPaper;
  /** The bar's public page, which a table card's code opens with its table; null when the bar has none. */
  pageUrl: string | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
  /** The menu is gone, or isn't the reader's to see. */
  missing: boolean;
}

/**
 * Everything the print set prints for one menu (Bet-print): the bar's name,
 * colour and face, each drink with what guests hear, its price and its spec
 * per serve (the run sheet's own build, lib/runSheet), who's on tonight
 * from the rota, the paper from where the bar is, and its public page for
 * the table cards.
 */
export function usePrintSet(menuId: string | null | undefined): PrintSet {
  const [date] = useState(() => new Date());
  const menu = useMenu(menuId);
  const barId = menu.data?.barId ?? null;
  const brand = useVenueBrand(barId);
  const run = useRunSheet(menuId);
  // Tonight: from now to the end of the night (lib/tonight serviceEnd), as Tonight's On shift reads it.
  const [night] = useState(() => ({ from: date.toISOString(), to: serviceEnd(date).toISOString() }));
  const rota = useShifts(barId, night.from, night.to);
  const shifts = rota.data;
  const team = useBarMembers(shifts?.length ? barId : null);
  const pageId = useBarPageId(barId);
  const facts = useBarFacts(pageId.data);

  const sheet = useMemo(
    () => (run.data ? buildRunSheet({ ...run.data, hostName: run.data.menu.hostName, hostLogoUrl: run.data.menu.hostLogoUrl, breakDownPreps: false, marginPct: DEFAULT_MARGIN_PCT }) : null),
    [run.data],
  );

  const drinks = useMemo((): PrintDrink[] => {
    if (!menu.data) return [];
    const byItem = new Map((sheet?.drinks ?? []).map((d) => [d.itemId, d]));
    const origin = siteOrigin();
    return menu.data.sections.flatMap((s) =>
      s.drinks.map((d) => {
        const built = byItem.get(d.id);
        const lines = built ? (built.parts ? built.parts.flatMap((p) => p.lines) : built.lines).filter((l) => !l.garnish) : [];
        return {
          id: d.id,
          name: d.name,
          line: d.line,
          price: printedPrice(d),
          spec: lines.map((l) => ({ amount: l.per, name: l.name })),
          serve: built?.serve ?? d.glass ?? '',
          url: `${origin}/cocktail/${d.id}`,
          publicUrl: `${origin}/d/${d.id}`,
        };
      }),
    );
  }, [menu.data, sheet]);

  // ponytail: the bar's face is display_face as main has it; the Themes stack (#1061) brings the drawn faces, read here unchanged.
  const bar: PrintBar | null = menu.data?.barId && brand.data ? { name: brand.data.name, accent: brand.data.primary_color ? normalizeHex(brand.data.primary_color) : null, face: faceFromDb(brand.data.display_face) } : null;
  // Who's on: the list on now's foot waits for it (an unread rota prints "Someone"); a rota that can't be read prints without it.
  const teamLine = shifts && (!shifts.length || team.data) ? (onShiftLine(shifts, (id) => team.data?.find((m) => m.user_id === id)?.display_name ?? 'Someone', null)?.names ?? null) : null;
  const teamPending = !!barId && !rota.error && (rota.isPending || (!!shifts?.length && team.isPending && !team.error));

  // The paper waits for the bar's zone, so the sheets aren't laid out twice; a page that can't be read prints on this device's paper.
  const pagePending = !!barId && !pageId.error && (pageId.isPending || (!!pageId.data && facts.isPending && !facts.error));
  const paper = paperFor(facts.data?.timezone);
  const pageUrl = pageId.data ? `${siteOrigin()}/p/${pageId.data}` : null;
  const loading = menu.isPending || (!!barId && (brand.isPending || run.isPending)) || teamPending || pagePending;
  // A menu that isn't there fails the run sheet's read too: that's missing, not failed.
  const failed = !!menu.error || (!!menu.data && (!!brand.error || !!run.error));
  const missing = !menu.isPending && !menu.data && !menu.error;
  const { refetch: menuAgain } = menu;
  const { refetch: brandAgain } = brand;
  const { refetch: runAgain } = run;
  const name = menu.data?.name ?? '';
  const barName = bar?.name;
  const barAccent = bar?.accent;
  const barFace = bar?.face;
  // One object per change, so the sheets built from it aren't rebuilt on every render.
  return useMemo(
    () => ({
      bar: barName !== undefined ? { name: barName, accent: barAccent ?? null, face: barFace! } : null,
      menuName: name,
      drinks,
      team: teamLine,
      date,
      paper,
      pageUrl,
      loading,
      failed,
      retry: () => {
        void menuAgain();
        void brandAgain();
        void runAgain();
      },
      missing,
    }),
    [barName, barAccent, barFace, name, drinks, teamLine, date, paper, pageUrl, loading, failed, missing, menuAgain, brandAgain, runAgain],
  );
}
