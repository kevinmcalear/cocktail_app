import { useNavigation, useRouter, type Href } from 'expo-router';
import { lazy, Suspense, useState, type ComponentProps } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, PressableScale, Tag } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMenuLens } from '@/hooks/useMenuLens';
import { useMenuEditionDrinks, useMenuEditions, useProfile } from '@/hooks/useProfiles';
import { drinkPageHref } from '@/lib/itemRoutes';
import { barDay, clockAt, DAILY_AFTER, dailyLead, dayText } from '@/lib/dailyList';
import { editionDates, editionMenu, editionMenuDrinks, editionSections, menuRange, menuState } from '@/lib/menuEditions';
import { screenBelow } from '@/lib/screenBelow';
import { shareOrCopy } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';

import { SaveMenuButton } from '../kept/SaveMenuButton';
import { GuestMenuPage } from '../menus/page/GuestMenuPage';
import { loadFailure, PublicMissing } from '../published/PublicShell';

// The team's menu page, with every layer they work from: only the bar's own staff get it, so guests on this page never load it.
const MenuScreen = lazy(() => import('../menus/MenuScreen').then((m) => ({ default: m.MenuScreen })));

/**
 * One menu a bar put out, on the menu page: a researched one, or the venue's
 * own menu on now or ended, in its sections with its prices (Menu-who-guest,
 * Menu-p-page; past menus leave prices off). Signed out too: a published drink
 * shows what's in it and opens its public page; a bar's drink kept to its team
 * shows its name and price. The bar's own team get the menu page they work
 * from, with its layers.
 */
export function MenuEditionScreen({ profileRef, editionId }: { profileRef: string; editionId: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const signedIn = useSignedIn();
  const { venues } = useActiveVenue();
  const profile = useProfile(profileRef);
  const editions = useMenuEditions(profile.data?.id);
  const edition = editions.data?.find((e) => e.id === editionId);
  const loaded = useMenuEditionDrinks(edition?.drinks ?? []);
  // ponytail: a guest's own day, not the bar's (get_menu_editions doesn't send the bar's time zone).
  const [today] = useState(() => barDay(Date.now()));
  if (!profile.data || !edition) return <PublicMissing loading={profile.isPending || (!!profile.data && editions.isPending)} what="menu" failed={loadFailure(profile, editions)} />;

  const bar = profile.data;
  if (edition.from_venue && venues.some((v) => v.id === bar.bar_id)) return (
      <Suspense fallback={<PublicMissing loading what="menu" />}>
        <MenuScreen menuId={edition.id} />
      </Suspense>
    );

  const readable = new Set((loaded.data ?? []).map((d) => d.id));
  const drinks = editionMenuDrinks(edition.drinks, loaded.data ?? []);
  const source = edition.source_url;
  const dates = editionDates(edition);
  const past = menuState(dates) === 'past';
  const now = past ? (editions.data ?? []).find((e) => e.is_current) : undefined;
  const barHref = `/p/${bar.handle || bar.id}` as const;
  const below = () => screenBelow(navigation.getState(), { id: profileRef, edition: editionId });
  // Nothing under it (opened from a link): Back goes to the bar's page.
  const back = () => (below() ? router.back() : router.replace(barHref));
  // Opened from the bar's Menus tab, From goes back to that page rather than stacking a second copy.
  const toBar = () => {
    const under = below();
    const id = under?.params.id;
    if (under?.name === 'p/[id]/index' && typeof id === 'string' && [bar.id, bar.handle, profileRef].includes(id)) router.back();
    else router.push(barHref);
  };
  const menu = editionMenu(edition, editionSections(edition, drinks), bar.bar_id ?? bar.id);
  // Tonight, the bar's daily list (Menu-l-tonight): today's date, when it was written, the new drinks marked.
  const daily = edition.list_type === 'daily' && !past;

  return (
    <>
      <WebHead>
        <title>{edition.name}</title>
      </WebHead>
      <BarGuestMenuPage
        menu={menu}
        status={past ? 'previous' : 'on'}
        eyebrow={[bar.display_name, daily ? dayText(today) : menuRange(dates)].filter(Boolean).join(' · ')}
        description={daily ? (edition.written_at ? dailyLead(edition.written_at, (iso) => clockAt(iso)) : 'Today’s list') : undefined}
        fresh={daily ? new Set(edition.drinks.filter((d) => d.new_today).map((d) => d.id)) : undefined}
        after={daily ? DAILY_AFTER : undefined}
        onNow={now ? { name: now.name, itemIds: new Set(now.drinks.map((d) => d.id)) } : null}
        onToNow={now ? () => router.replace(`/p/${bar.handle || bar.id}/menus/${now.id}` as Href) : undefined}
        onBack={back}
        onShare={() => void shareOrCopy(`${siteOrigin()}${barHref}/menus/${edition.id}`, edition.name, 'menu')}
        rowPress={(row) => (readable.has(row.drink.id) ? () => router.push(drinkPageHref(row.drink.id, signedIn) as Href) : null)}
        under={
          <View style={styles.under}>
            <PressableScale role="link" accessibilityLabel={`From ${bar.display_name}, open their profile`} onPress={toBar} style={styles.start}>
              <Tag label={`From ${bar.display_name}`} tone="accent" />
            </PressableScale>
            <SaveMenuButton editionId={edition.id} drinkIds={edition.drinks.map((d) => d.id)} fromVenue={edition.from_venue} />
          </View>
        }
        footer={
          source ? (
            <View style={styles.start}>
              <Button label="Where this menu comes from" variant="secondary" onPress={() => void Linking.openURL(source)} />
            </View>
          ) : null
        }
      />
    </>
  );
}

/** A bar's menu marks the drinks with the guest's own allergies. */
function BarGuestMenuPage(props: Omit<ComponentProps<typeof GuestMenuPage>, 'lens'>) {
  return <GuestMenuPage {...props} lens={useMenuLens(props.menu)} />;
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  under: { gap: space.sm },
});
