import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, PressableScale, Tag } from '@/components/ds';
import { useMenuEditionDrinks, useMenuEditions, useProfile } from '@/hooks/useProfiles';
import { editionDates, editionMenuDrinks, editionSections, menuRange, menuState } from '@/lib/menuEditions';
import { plural } from '@/lib/menus';

import { SaveMenuButton } from '../kept/SaveMenuButton';
import { MenuSections } from '../menus/MenuSections';
import { loadFailure, PublicMissing, PublicShell } from '../published/PublicShell';

/**
 * One menu a bar put out, set like the printed menu: a researched one, or the
 * venue's own menu on now or ended, in its sections with its prices. A drink
 * the reader can open links to it; signed out, or a bar's drink kept to its
 * team, the menu shows its name (and price).
 */
export function MenuEditionScreen({ profileRef, editionId }: { profileRef: string; editionId: string }) {
  const router = useRouter();
  const profile = useProfile(profileRef);
  const editions = useMenuEditions(profile.data?.id);
  const edition = editions.data?.find((e) => e.id === editionId);
  const loaded = useMenuEditionDrinks(edition?.drinks ?? []);
  if (!profile.data || !edition) return <PublicMissing loading={profile.isPending || (!!profile.data && editions.isPending)} what="menu" failed={loadFailure(profile, editions)} />;

  const bar = profile.data;
  const readable = new Set((loaded.data ?? []).map((d) => d.id));
  const drinks = editionMenuDrinks(edition.drinks, loaded.data ?? []);
  const cover = drinks.find((d) => d.imageUrl && !d.isSketch)?.imageUrl ?? null;
  const source = edition.source_url;
  const dates = editionDates(edition);

  return (
    <PublicShell title={edition.name} imageUrl={cover}>
      <PressableScale role="link" accessibilityLabel={`From ${bar.display_name}, open their profile`} onPress={() => router.push(`/p/${bar.handle}`)} style={styles.start}>
        <Tag label={`From ${bar.display_name}`} tone="accent" />
      </PressableScale>
      {menuState(dates) === 'past' ? <Tag label="Past menu" style={styles.start} /> : null}
      <Display>{edition.name}</Display>
      <Caption tone="muted">{[menuRange(dates), drinks.length ? plural(drinks.length, 'drink') : null].filter(Boolean).join(' · ')}</Caption>
      {edition.theme ? <Body tone="muted">{edition.theme}</Body> : null}
      <SaveMenuButton editionId={edition.id} drinkIds={edition.drinks.map((d) => d.id)} fromVenue={edition.from_venue} />
      {drinks.length ? (
        <MenuSections sections={editionSections(edition, drinks)} variant="page" hrefFor={(d) => (readable.has(d.id) ? `/cocktail/${d.id}` : null)} />
      ) : (
        <Body tone="muted">The drinks on this menu aren’t listed yet.</Body>
      )}
      {source ? (
        <View style={styles.start}>
          <Button label="Where this menu comes from" variant="secondary" onPress={() => void Linking.openURL(source)} />
        </View>
      ) : null}
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
});
