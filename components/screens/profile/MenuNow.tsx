import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMenuEditions, type Original } from '@/hooks/useProfiles';
import { creators } from '@/lib/lineage';
import { editionDates, timelineDates } from '@/lib/menuEditions';
import { plural } from '@/lib/menus';

import { LockedRow } from './LockedOriginals';

/**
 * The menu a bar is pouring now: each drink with who made it (a link to their
 * page), what it's like, and a lock while the page keeps its specs back
 * (find-yourself step 2). A drink also on the menu before says so.
 * Wide: "Night Garden · On now · since Mar 2026", every drink. `first`: a
 * phone's Drinks tab (Q30 A), "On the menu now · Field Notes · 12 drinks",
 * the first few, then "All 12 on Field Notes" opens the menu.
 */
export function MenuNow({ profileId, originals, details, first, locked = true }: { profileId: string; originals: readonly Original[]; details: boolean; first?: number; locked?: boolean }) {
  const router = useRouter();
  // Newest first.
  const editions = useMenuEditions(profileId).data ?? [];
  const now = editions.find((e) => e.is_current);
  if (!now?.drinks.length) return null;
  const byId = new Map(originals.map((d) => [d.id, d]));
  // The menu before this one: the newest that isn't on.
  const last = editions.find((e) => !e.is_current);
  const before = new Set(last?.drinks.map((d) => d.id) ?? []);
  const shown = first ? now.drinks.slice(0, first) : now.drinks;
  return (
    <View role="region" accessibilityLabel={first ? 'On the menu now' : now.name} style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading" style={styles.shrink}>
          {first ? 'On the menu now' : now.name}
        </Headline>
        <Caption tone="muted">{first ? `${now.name} · ${plural(now.drinks.length, 'drink')}` : timelineDates(editionDates(now))}</Caption>
      </View>
      <View role="list">
        {shown.map((m) => {
          const d = byId.get(m.id);
          return (
            <LockedRow
              key={m.id}
              drink={d ?? m}
              people={d ? creators(d).filter((p) => p.id !== profileId) : []}
              after={before.has(m.id) ? 'on the last menu too' : null}
              details={details}
              quiet={!locked}
            />
          );
        })}
      </View>
      {now.drinks.length > shown.length ? (
        <View style={styles.start}>
          <TextLink label={`All ${now.drinks.length} on ${now.name}`} onPress={() => router.push(`/p/${profileId}/menus/${now.id}` as Href)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: space.md },
  shrink: { flexShrink: 1 },
  start: { alignSelf: 'flex-start' },
});
