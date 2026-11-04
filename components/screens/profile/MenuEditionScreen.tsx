import { Redirect, useIsFocused, useNavigation, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ComponentProps } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { BackbarTheme, Button } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { useSignedIn } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMenuLens } from '@/hooks/useMenuLens';
import { usePhotoTone } from '@/hooks/usePhotoTone';
import { useMenuEditionDrinks, useMenuEditions, useProfile } from '@/hooks/useProfiles';
import { drinkPageHref } from '@/lib/itemRoutes';
import { barDay, clockAt, DAILY_AFTER, dailyLead, dayText } from '@/lib/dailyList';
import { inMenuQuery } from '@/lib/menuPager';
import { editionDates, editionMenu, editionMenuDrinks, editionSections, menuRange, menuState } from '@/lib/menuEditions';
import { screenBelow } from '@/lib/screenBelow';
import { shareOrCopy } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';
import type { MenuDrink } from '@/types/menus';

import { GuestMenuPage } from '../menus/page/GuestMenuPage';
import { NotPublishedSheet } from '../menus/page/NotPublishedSheet';
import { loadFailure, PublicMissing } from '../published/PublicShell';

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
  // A drink the bar hasn't published: a small card instead of a page (Kevin, 3 Nov).
  const [notYet, setNotYet] = useState<MenuDrink | null>(null);
  if (!profile.data || !edition) return <PublicMissing loading={profile.isPending || (!!profile.data && editions.isPending)} what="menu" failed={loadFailure(profile, editions)} />;

  const bar = profile.data;
  // The bar's own team go to the menu page they work from (/menus/[id]), with its layers.
  if (edition.from_venue && venues.some((v) => v.id === bar.bar_id)) return <Redirect href={`/menus/${edition.id}` as Href} />;

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
        offTonight={new Set(edition.drinks.filter((d) => d.off_tonight).map((d) => d.id))}
        eyebrow={[bar.display_name, daily ? dayText(today) : menuRange(dates)].filter(Boolean).join(' · ')}
        description={daily ? (edition.written_at ? dailyLead(edition.written_at, (iso) => clockAt(iso)) : 'Today’s list') : undefined}
        fresh={daily ? new Set(edition.drinks.filter((d) => d.new_today).map((d) => d.id)) : undefined}
        after={daily ? DAILY_AFTER : undefined}
        onNow={now ? { name: now.name, itemIds: new Set(now.drinks.map((d) => d.id)) } : null}
        onToNow={now ? () => router.replace(`/p/${bar.handle || bar.id}/menus/${now.id}` as Href) : undefined}
        onBack={back}
        onShare={() => void shareOrCopy(`${siteOrigin()}${barHref}/menus/${edition.id}`, edition.name, 'menu')}
        // The drink opens in its menu: "Autumn · 4 of 8" and the pager (Menu-pager).
        rowPress={(row) => (readable.has(row.drink.id) ? () => router.push(`${drinkPageHref(row.drink.id, signedIn)}?${inMenuQuery(edition.id, bar.handle || bar.id)}` as Href) : () => setNotYet(row.drink))}
        footer={
          source ? (
            <View style={styles.start}>
              <Button label="Where this menu comes from" variant="secondary" onPress={() => void Linking.openURL(source)} />
            </View>
          ) : null
        }
      />
      {notYet ? <NotPublishedSheet drink={notYet} barName={bar.display_name ?? edition.name} onClose={() => setNotYet(null)} /> : null}
    </>
  );
}

/** A bar's menu marks the drinks with the guest's own allergies. */
function BarGuestMenuPage(props: Omit<ComponentProps<typeof GuestMenuPage>, 'lens'>) {
  // The cover photo sets light or dark for the page (Menu-g-photo-dark, Menu-g-photo-bright).
  const tone = usePhotoTone(props.menu.coverUrl);
  const focused = useIsFocused();
  return (
    <BackbarTheme scheme={props.menu.coverUrl ? tone : undefined}>
      {/* The clock and battery follow the page's tone, not the phone's (iOS and Android); only while it's on top, as the staff menu does. */}
      {props.menu.coverUrl && focused ? <StatusBar style={tone === 'dark' ? 'light' : 'dark'} /> : null}
      <GuestMenuPage {...props} lens={useMenuLens(props.menu)} />
    </BackbarTheme>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
});
