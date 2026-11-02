import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { Caption } from '@/components/ds';
import { MenuGroup } from '@/components/screens/menus/MenuGroupList';
import { MenuLine } from '@/components/screens/menus/MenuRows';
import type { DrinkMenuRun } from '@/hooks/useProfiles';
import { leftTheMenu, menuRange, menuState } from '@/lib/menuEditions';

/** Your venue's menu this drink is on now, with its price there. */
export interface OwnMenu {
  menuId: string;
  name: string;
  venueName: string | null;
  price: string | null;
}

/**
 * On the menu (Menu-p-left, BandElsewhere), as lines: your venue's menu it's
 * on now, then each menu it was on, with "On now" or when it ran, so nobody
 * walks up and asks for one that came off. Each opens that menu. Nothing for
 * a drink no menu lists.
 */
export function MenuRuns({ runs, own }: { runs: DrinkMenuRun[]; own?: OwnMenu | null }) {
  const router = useRouter();
  if (!runs.length && !own) return null;
  // Name your venue only when another bar's menus are listed too.
  const others = runs.length > 0;
  // One bar: the menu's name is enough. Several: each says whose.
  const several = new Set(runs.map((r) => r.barId)).size > 1;
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
        {runs.map((r, i) => {
          const live = menuState(r) === 'current';
          const line = live ? 'On now' : menuRange(r);
          return (
            <MenuLine
              key={`${r.barId}:${i}`}
              // A drink that came off and went back on later has a line for each run.
              name={several ? `${r.editionName}, ${r.barName}` : r.editionName}
              line={line}
              live={live}
              label={`${r.editionName} at ${r.barName}, ${line}. Open the menu`}
              onPress={() => router.push(`/p/${r.barId}/menus/${r.editionId}` as Href)}
            />
          );
        })}
      </View>
      {!own && leftTheMenu(runs) ? <Caption tone="muted">Not on the menu now. You can still rank it if you had it.</Caption> : null}
    </MenuGroup>
  );
}
