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
 * On the menu (menus-one-look, BandElsewhere): the menus a drink is on, or
 * was, as lines: the name, then "On now" or when it ran, so nobody walks up
 * and asks for one that came off. Your own venue's menu first. Each opens
 * the menu. Nothing for a drink no menu lists.
 */
export function MenuRuns({ runs, own }: { runs: DrinkMenuRun[]; own?: OwnMenu | null }) {
  const router = useRouter();
  if (!runs.length && !own) return null;
  // Name the bar only when the drink is on more than one bar's menus.
  const bars = new Set(runs.map((r) => r.barId)).size;
  return (
    <MenuGroup title="On the menu">
      <View role="list">
        {own ? (
          <MenuLine
            name={own.name}
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
              name={bars > 1 ? `${r.editionName}, ${r.barName}` : r.editionName}
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
