import { useDs } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useItemSketches } from '@/hooks/useItemSketch';
import { useDrinkCredit } from '@/hooks/useLineage';
import { useMenu } from '@/hooks/useMenus';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyRankList, useRankTarget } from '@/hooks/useRankings';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { faceFromDb, normalizeHex } from '@/lib/brand';
import { cardWhen } from '@/lib/menus';
import type { PaperPage, PosterSize } from '@/lib/paper/page';
import { menuPoster, topThreePoster } from '@/lib/paper/poster';
import { rankedAs } from '@/lib/ranking';
import type { SketchInputs } from '@/lib/sketch/types';

/** A poster to show and send, or why there isn't one yet. */
export interface PosterData {
  page: PaperPage | null;
  sketches: Record<string, SketchInputs | null>;
  /** Everything it draws has arrived: the picture can be taken. */
  ready: boolean;
  /** What the share sheet and the file are called. */
  title: string;
  /** Loading failed; `retry` asks again. */
  failed: boolean;
  retry: () => void;
  /** Nothing to draw: the line to show instead. */
  empty: string | null;
}

// A menu's drinks are drawn from its first few, so only those are asked for.
const DRAWN_FROM = 8;

/** A menu's poster: in its bar's colour and face, or on the app's paper for a home menu. */
export function useMenuPoster(menuId: string, size: PosterSize): PosterData {
  const ds = useDs();
  const menu = useMenu(menuId);
  const brand = useVenueBrand(menu.data?.barId);
  const drinks = (menu.data?.sections ?? []).flatMap((s) => s.drinks);
  const sketches = useItemSketches(drinks.slice(0, DRAWN_FROM).map((d) => d.id));
  const bar = menu.data?.barId ? brand.data : null;
  const waiting = menu.isPending || (!!menu.data?.barId && brand.isPending);
  const page =
    menu.data && !waiting
      ? menuPoster(
          {
            name: menu.data.name,
            eyebrow: bar?.name ?? cardWhen(menu.data),
            drinks: drinks.map((d) => ({ id: d.id, name: d.name, drawn: !!sketches.byId[d.id] })),
            accent: bar?.primary_color ? normalizeHex(bar.primary_color) : null,
            face: faceFromDb(bar?.display_face),
            scheme: ds.scheme,
          },
          size,
        )
      : null;
  return {
    page,
    sketches: sketches.byId,
    ready: !!page && sketches.ready,
    title: menu.data?.name ?? 'Menu',
    // A bar whose brand can't be read still has a poster, on the app's paper.
    failed: !!menu.error,
    retry: () => void menu.refetch(),
    empty: !menu.isPending && !menu.data && !menu.error ? 'This menu isn’t there any more, or it isn’t yours to see.' : null,
  };
}

/** Your top three of one drink, best first, with your score, the bar and who made it. */
export function useTopThreePoster(listId: string, size: PosterSize): PosterData {
  const ds = useDs();
  const signedIn = useSignedIn();
  const target = useRankTarget(listId);
  const list = target.data ? rankedAs(target.data) : null;
  const mine = useMyRankList(list?.id);
  const me = useMyProfile();
  const top = (mine.data ?? []).slice(0, 3);
  const ids = top.map((e) => e.item_id);
  const sketches = useItemSketches(ids);
  // Three, always called: hooks can't sit in a loop.
  const credits = [useDrinkCredit(ids[0]), useDrinkCredit(ids[1]), useDrinkCredit(ids[2])];
  // isLoading, not isPending: a list read while signed out, or a credit with no id, never runs.
  const waiting = target.isPending || mine.isLoading || credits.some((c) => c.isLoading);
  const page =
    list && top.length && !waiting
      ? topThreePoster(
          {
            person: me.data?.displayName?.trim().split(/\s+/)[0] || null,
            listName: list.name,
            entries: top.map((e, i) => ({ itemId: e.item_id, score: e.score, bar: e.venue?.display_name ?? null, maker: credits[i]?.data?.creator_names?.[0] ?? null, drawn: !!sketches.byId[e.item_id] })),
            scheme: ds.scheme,
          },
          size,
        )
      : null;
  const failed = !!target.error || !!mine.error;
  return {
    page,
    sketches: sketches.byId,
    ready: !!page && sketches.ready,
    title: list ? `My best ${list.name}` : 'My top three',
    failed,
    retry: () => {
      void target.refetch();
      void mine.refetch();
    },
    empty: !signedIn
      ? 'Sign in to keep your own list and share it.'
      : !failed && !waiting && list && !top.length
        ? `You haven’t ranked a ${list.name} yet. Open one and tap Rank it.`
        : !failed && !target.isPending && !list
          ? 'This drink isn’t there any more.'
          : null,
  };
}
