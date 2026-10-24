import { useRouter, type Href } from 'expo-router';

import { DrinkThumb, MenuRowFrame } from '@/components/screens/menus/MenuRows';
import { MenuGroup } from '@/components/screens/menus/MenuGroupList';
import { useSavedMenus } from '@/hooks/useKept';
import { menuState } from '@/lib/menuEditions';

/**
 * Bar menus you saved (Save menu on a bar's menu page), on Collection's
 * Menus, as menu rows (menus-one-look): the first drink's square, the menu's
 * name, then the bar, whether it's on, and how much of it your shelf makes,
 * or "names only" when none of its specs are open. Nothing when there are none.
 * ponytail: the square is the drink's sketch; its photo needs the saved
 * menus query to bring image urls.
 */
export function CollectionSavedMenus({ canMakeIds }: { canMakeIds: Set<string> }) {
  const router = useRouter();
  const menus = useSavedMenus().data ?? [];
  if (!menus.length) return null;
  return (
    <MenuGroup title="Saved from bars">
      {menus.map((m) => {
        const ready = m.drinkIds.filter((id) => canMakeIds.has(id)).length;
        const when = m.dates.isCurrent ? 'on now' : menuState(m.dates) === 'past' ? 'past menu' : null;
        const make = !m.openSpecs ? 'names only' : m.drinkIds.length ? `${ready} of ${m.drinkIds.length} you can make` : null;
        const line = [m.barName, when, make].filter(Boolean).join(' · ');
        return (
          <MenuRowFrame
            key={m.editionId}
            label={`${m.name}, ${line}`}
            onPress={() => router.push(`/p/${m.barId}/menus/${m.editionId}` as Href)}
            thumb={<DrinkThumb itemId={m.drinkIds[0] ?? null} name={m.name} />}
            name={m.name}
            line={line}
          />
        );
      })}
    </MenuGroup>
  );
}
