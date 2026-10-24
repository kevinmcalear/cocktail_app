import { useRouter, type Href } from 'expo-router';

import { DrinkThumb, MenuRowFrame } from '@/components/screens/menus/MenuRows';
import { MenuGroup } from '@/components/screens/menus/MenuGroupList';
import { useCollection } from '@/hooks/useCollection';
import { plural } from '@/lib/menus';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

/**
 * Releases collected from bars, on Collection's Menus, as menu rows
 * (menus-one-look): its cover or first drink, its name, then the bar, when it
 * came out, and how much of it your shelf makes. One no longer public stays,
 * but doesn't open. Nothing when there are none.
 */
export function CollectionReleases({ canMakeIds }: { canMakeIds: Set<string> }) {
  const router = useRouter();
  const releases = useCollection().data?.releases ?? [];
  if (!releases.length) return null;
  return (
    <MenuGroup title="Releases">
      {releases.map((r) => {
        const ids = r.itemIds ?? [];
        const ready = ids.filter((id) => canMakeIds.has(id)).length;
        const line = [r.barName, r.releaseDate ? shortDay(r.releaseDate) : null, ids.length ? `${plural(ids.length, 'drink')}, ${ready} you can make` : null, r.live ? null : 'no longer public']
          .filter(Boolean)
          .join(' · ');
        const releaseId = r.live ? r.releaseId : null;
        return (
          <MenuRowFrame
            key={r.id}
            label={`${r.name}, ${line}`}
            onPress={releaseId ? () => router.push(`/r/${releaseId}` as Href) : undefined}
            thumb={<DrinkThumb itemId={ids[0] ?? null} imageUrl={r.coverUrl} name={r.name} />}
            name={r.name}
            line={line}
          />
        );
      })}
    </MenuGroup>
  );
}
