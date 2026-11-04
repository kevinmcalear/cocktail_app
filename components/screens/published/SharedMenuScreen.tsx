import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Caption, PressableScale } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { useSignedIn } from '@/ctx/AuthContext';
import type { MenuLensData } from '@/hooks/useMenuLens';
import { publishedMenuDrink } from '@/hooks/useMenus';
import { useSharedMenu, type SharedMenuPage } from '@/hooks/useSharedMenu';
import { drinkPageHref } from '@/lib/itemRoutes';
import { isPrivateDrink, PRIVATE_DRINK } from '@/lib/menus';
import { ingredientsLine } from '@/lib/ingredientsLine';
import { shareOrCopy } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';
import type { MenuDetail, MenuDrink } from '@/types/menus';

import { GuestMenuPage } from '../menus/page/GuestMenuPage';
import { ReportSheet } from '../safety/ReportSheetLazy';
import { loadFailure, PublicMissing } from './PublicShell';
import { dayMonth } from '@/lib/dayMonth';

/** A friend is a guest with nothing to add: useMenuLens's reads are all a bar's, and stay off this public page. */
const FRIEND: MenuLensData = { lens: 'guest', notes: {}, allergens: new Map(), mine: new Map(), cost: new Map(), costs: false, averageCost: null, rows: [], prep: false };

/** "Sat 31 Oct", the night the menu is for (a date with no time zone). */
export function menuNight(day: string, locale = 'en-GB'): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return dayMonth(date, { weekday: 'short', month: 'short' }, locale);
}

/** A drink on the menu that isn't public: it holds its place, with no name. */
const privateDrink = (sectionId: string, index: number): MenuDrink => ({
  id: `${PRIVATE_DRINK}${sectionId}:${index}`,
  name: 'House drink',
  kind: 'cocktail',
  line: 'Kept private',
  price: null,
  imageUrl: null,
  isSketch: false,
  glass: 'Martini',
});

/** The shared menu in the shape the menu page reads: a home menu, so it's always drawn and has no prices. */
function sharedMenu(data: SharedMenuPage): MenuDetail {
  return {
    id: data.id,
    name: data.name,
    barId: null,
    createdBy: data.owner.profileId,
    coverUrl: null,
    coverPosition: 50,
    startsAt: null,
    endsAt: null,
    createdAt: '',
    updatedAt: '',
    menuDate: data.menuDate,
    guestCount: null,
    sharedAt: null,
    kind: 'menu',
    description: null,
    plannedStartsAt: null,
    plannedEndsAt: null,
    hiddenAt: null,
    sections: data.sections.map((s) => ({
      id: s.id,
      name: s.name,
      minItems: 0,
      maxItems: null,
      allowedTypes: [],
      // Each drink's line is its ingredients ("Campari, sweet vermouth, soda, orange"), else its description. Names only, never amounts.
      drinks: s.drinks.map((d, i) => {
        const drink = d && publishedMenuDrink(d);
        if (!drink) return privateDrink(s.id, i);
        return { ...drink, line: ingredientsLine(data.ingredients[drink.id] ?? []) ?? drink.line };
      }),
    })),
  };
}

/**
 * A home menu someone shared (/m/<id>), on the menu page as a friend sees it
 * (Menu-h-friend): no way back but home, whose menu it is and the night, then
 * the drinks with no prices and no amounts. Drinks that aren't public keep
 * their place as "House drink", never their names.
 */
export function SharedMenuScreen({ id }: { id: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const query = useSharedMenu(id);
  const { data, isPending } = query;
  const [reporting, setReporting] = useState(false);
  if (!data) return <PublicMissing loading={isPending} what="menu" failed={loadFailure(query)} />;

  const { owner } = data;

  return (
    <>
      <WebHead>
        <title>{data.name}</title>
      </WebHead>
      <GuestMenuPage
        menu={sharedMenu(data)}
        lens={FRIEND}
        status="on"
        eyebrow={[`${owner.name}’s menu`, data.menuDate ? menuNight(data.menuDate) : null].filter(Boolean).join(' · ')}
        onBack={null}
        label={{ text: 'Cocktail', onPress: () => router.push('/') }}
        onShare={() => void shareOrCopy(`${siteOrigin()}/m/${id}`, data.name, 'menu')}
        rowPress={(row) => (isPrivateDrink(row.drink.id) ? null : () => router.push(drinkPageHref(row.drink.id, signedIn) as Href))}
        after={`${owner.name}’s own recipes stay private: you see what is in each drink, not the amounts. Open in Cocktail to keep this menu.`}
        footer={
          // Signed out, Report asks you to sign in first: a report needs an account.
          <PressableScale role="link" accessibilityLabel="Report this menu" onPress={() => (signedIn ? setReporting(true) : router.push('/auth/login'))} style={styles.start}>
            <Caption tone="muted" style={styles.underline}>
              Report this menu
            </Caption>
          </PressableScale>
        }
      />
      {reporting ? (
        <ReportSheet subject={data.name} targets={[{ label: `${owner.name}, who shared this menu`, target: { kind: 'profile', profileId: owner.profileId } }]} onClose={() => setReporting(false)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
});
