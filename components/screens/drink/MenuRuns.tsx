import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { MenuGroup } from '@/components/screens/menus/MenuGroupList';
import { MenuLine } from '@/components/screens/menus/MenuRows';
import type { DrinkMenuRun } from '@/hooks/useProfiles';
import { menuRange, menuState } from '@/lib/menuEditions';

/** Your venue's menu this drink is on now, with its price there. */
export interface OwnMenu {
  menuId: string;
  name: string;
  venueName: string | null;
  price: string | null;
}

/**
 * On the menu (menus-one-look, BandElsewhere), as lines: your venue's menu
 * it's on now, then each bar whose menus it was on, with "On now" or when
 * it ran, so nobody walks up and asks for one that came off. Each opens the
 * menu (a bar's latest with it). Nothing for a drink no menu lists.
 */
export function MenuRuns({ runs, own }: { runs: DrinkMenuRun[]; own?: OwnMenu | null }) {
  const router = useRouter();
  if (!runs.length && !own) return null;
  // Name your venue only when another bar's menus are listed too.
  const others = runs.length > 0;
  return (
    <MenuGroup title="On the menu">
      <View>
        {own ? (
          <MenuLine
            name={others && own.venueName ? `${own.name}, ${own.venueName}` : own.name}
            line={['On now', own.price].filter(Boolean).join(' · ')}
            live
            label={[own.name, own.venueName, 'on now', own.price ? `${own.price} there` : null].filter(Boolean).join(', ')}
            onPress={() => router.push(`/menus/${own.menuId}` as Href)}
          />
        ) : null}
        {runs.map((r) => {
          const live = menuState(r) === 'current';
          const line = live ? 'On now' : menuRange(r);
          return (
            <MenuLine
              key={r.barId}
              // A run spans every menu at the bar it was on, so the line names the bar, not one menu.
              name={r.barName}
              line={line}
              live={live}
              label={`${r.editionName} at ${r.barName}, ${line}. Open the menu`}
              onPress={() => router.push(`/p/${r.barId}/menus/${r.editionId}` as Href)}
            />
          );
        })}
      </View>
    </MenuGroup>
  );
}
