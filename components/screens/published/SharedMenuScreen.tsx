import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Display, PressableScale, Tag } from '@/components/ds';
import { space } from '@/constants/tokens';
import { publishedMenuDrink } from '@/hooks/useMenus';
import { useSharedMenu } from '@/hooks/useSharedMenu';
import { dayLabel } from '@/lib/collection';
import { plural } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

import { MenuSections } from '../menus/MenuSections';
import { ReportAction } from '../safety/ReportSheet';
import { loadFailure, PublicMissing, PublicShell } from './PublicShell';

const PRIVATE = 'private:';

/** A drink on the menu that isn't public: it holds its place, with no name. */
const privateDrink = (sectionId: string, index: number): MenuDrink => ({
  id: `${PRIVATE}${sectionId}:${index}`,
  name: 'House drink',
  kind: 'cocktail',
  line: 'Kept private',
  price: null,
  imageUrl: null,
  isSketch: false,
  glass: null,
});

/**
 * A home menu someone shared (/m/<id>), as anyone sees it: set like the
 * printed menu, with its public drinks opening their pages. Drinks that
 * aren't public keep their place as "House drink", never their names.
 */
export function SharedMenuScreen({ id }: { id: string }) {
  const router = useRouter();
  const query = useSharedMenu(id);
  const { data, isPending } = query;
  const [now] = useState(() => Date.now());
  if (!data) return <PublicMissing loading={isPending} what="menu" failed={loadFailure(query)} />;

  const { owner } = data;
  const drinks = data.sections.flatMap((s) => s.drinks);
  const cover = data.coverUrl ?? drinks.find((d) => d?.imageUrl && !d.imageIsGenerated)?.imageUrl ?? null;
  const sections = data.sections.map((s) => ({
    id: s.id,
    name: s.name,
    drinks: s.drinks.map((d, i) => (d && publishedMenuDrink(d)) ?? privateDrink(s.id, i)),
  }));

  return (
    <PublicShell title={data.name} imageUrl={cover}>
      <PressableScale role="link" accessibilityLabel={`Shared by ${owner.name}, open their profile`} onPress={() => router.push(`/p/${owner.handle}`)} style={styles.owner}>
        <Tag label={`Shared by ${owner.name}`} tone="accent" />
      </PressableScale>
      <Display>{data.name}</Display>
      <Caption tone="muted">{[data.menuDate ? dayLabel(data.menuDate, now) : null, plural(drinks.length, 'drink')].filter(Boolean).join(' · ')}</Caption>
      {drinks.length ? (
        <MenuSections sections={sections} variant="page" hrefFor={(d) => (d.id.startsWith(PRIVATE) ? null : `/d/${d.id}`)} />
      ) : (
        <Body tone="muted">No drinks on this menu yet.</Body>
      )}
      <View style={styles.report}>
        <ReportAction subject={data.name} targets={[{ label: `${owner.name}, who shared this menu`, target: { kind: 'profile', profileId: owner.profileId } }]} />
      </View>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  owner: { alignSelf: 'flex-start' },
  report: { alignItems: 'flex-start', marginTop: space.lg },
});
