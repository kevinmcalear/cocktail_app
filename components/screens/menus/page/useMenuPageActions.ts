import { useRouter, type Href } from 'expo-router';
import { Alert } from 'react-native';

import { useListChanges } from '@/hooks/useLivingList';
import { useEndMenu } from '@/hooks/useMenuMutations';
import { confirmAsync } from '@/lib/dialogs';
import type { MenuDetail, MenuStatus } from '@/types/menus';

import type { GroupAction } from './menuPageModel';

export type PageSheet = 'more' | 'night' | 'share' | 'publish' | null;

/**
 * What the menu page's group rows do (On, Costing, Run sheet, On the bar page,
 * End this menu, a draft's Goes on, a home menu's Shopping list), and the
 * rows the board keeps off the page, which the More sheet lists instead.
 */
export function useMenuPageActions({ menu, status, liveId, setSheet, toShopping }: { menu: MenuDetail; status: MenuStatus; liveId: string | null; setSheet: (s: PageSheet) => void; toShopping?: () => void }) {
  const router = useRouter();
  const end = useEndMenu();
  const hide = useListChanges(menu.id).hide;
  const go = (href: string) => router.push(href as Href);
  const failed = (message: string) => Alert.alert(message);
  const endMenu = async () => {
    // A list still to come has nothing to end: it goes back to being a draft (as in More).
    const ok = await confirmAsync(
      status === 'upcoming'
        ? { title: `Unschedule ${menu.name}?`, message: 'It goes back to being a draft.', confirmText: 'Unschedule' }
        : { title: `End ${menu.name}?`, message: 'It moves to Past. You can put it on again later.', confirmText: 'End it' },
    );
    if (!ok) return;
    try {
      await end.mutateAsync(menu.id);
    } catch {
      failed('That didn’t work. Try again.');
    }
  };
  const actions: Record<Exclude<GroupAction, null>, () => void> = {
    dates: () => setSheet('more'),
    end: () => void endMenu(),
    barPage: () => hide.mutate(!menu.hiddenAt, { onError: () => failed('That didn’t work. Try again.') }),
    costing: () => go(`/menus/${menu.id}/costing`),
    runSheet: () => go(`/menus/${menu.id}/run-sheet`),
    prep: () => go('/prep'),
    offMenu: () => go('/off-menu'),
    publish: () => setSheet('publish'),
    replaces: () => (liveId ? go(`/menus/${liveId}`) : undefined),
    night: () => setSheet('night'),
    shopping: () => toShopping?.(),
  };
  return { actions, go };
}
