import { StyleSheet, View } from 'react-native';

import { Caption, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMenuEditions, type Original } from '@/hooks/useProfiles';
import { creators } from '@/lib/lineage';
import { editionDates, timelineDates } from '@/lib/menuEditions';

import { LockedRow } from './LockedOriginals';

/**
 * The menu a bar is pouring now, at the top of its Menus tab while the page
 * keeps its specs back (find-yourself step 2): "Night Garden · On now · since
 * Mar 2026", then each drink with who made it (a link to their page), what
 * it's like and a lock. A drink also on the menu before says so.
 */
export function MenuNow({ profileId, originals, details }: { profileId: string; originals: readonly Original[]; details: boolean }) {
  // Newest first.
  const editions = useMenuEditions(profileId).data ?? [];
  const now = editions.find((e) => e.is_current);
  if (!now?.drinks.length) return null;
  const byId = new Map(originals.map((d) => [d.id, d]));
  // The menu before this one: the newest that isn't on.
  const last = editions.find((e) => !e.is_current);
  const before = new Set(last?.drinks.map((d) => d.id) ?? []);
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading" style={styles.shrink}>
          {now.name}
        </Headline>
        <Caption tone="muted">{timelineDates(editionDates(now))}</Caption>
      </View>
      <View role="list">
        {now.drinks.map((m) => {
          const d = byId.get(m.id);
          return (
            <LockedRow
              key={m.id}
              drink={d ?? m}
              people={d ? creators(d).filter((p) => p.id !== profileId) : []}
              after={before.has(m.id) ? 'on the last menu too' : null}
              details={details}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: space.md },
  shrink: { flexShrink: 1 },
});
