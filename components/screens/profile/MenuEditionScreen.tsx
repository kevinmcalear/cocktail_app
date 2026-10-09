import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, PressableScale, Tag } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useMenuEditionDrinks, useMenuEditions, useProfile } from '@/hooks/useProfiles';
import { editionDates, editionMenuDrinks, menuRange, menuState } from '@/lib/menuEditions';
import { plural } from '@/lib/menus';

import { MenuSections } from '../menus/MenuSections';
import { PublicMissing, PublicShell } from '../published/PublicShell';

/**
 * One menu a bar put out, set like the printed menu. Signed-in readers open
 * each cocktail; signed out, the bar's own drinks aren't public, so the menu
 * shows their names.
 */
export function MenuEditionScreen({ profileRef, editionId }: { profileRef: string; editionId: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const profile = useProfile(profileRef);
  const editions = useMenuEditions(profile.data?.id);
  const edition = editions.data?.find((e) => e.id === editionId);
  const loaded = useMenuEditionDrinks(edition?.drinks ?? []);
  if (!profile.data || !edition) return <PublicMissing loading={profile.isPending || (!!profile.data && editions.isPending)} what="menu" />;

  const bar = profile.data;
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
      {drinks.length ? (
        <MenuSections sections={[{ id: edition.id, name: 'Cocktails', drinks }]} variant="page" hrefFor={(d) => (signedIn ? `/cocktail/${d.id}` : null)} />
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
