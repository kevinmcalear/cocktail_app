import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Button, Caption, DrinkImage, DsText, PressableScale, Surface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { backbar, displayFaces, radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { publishedMenuDrink } from '@/hooks/useMenus';
import { useSharedMenu } from '@/hooks/useSharedMenu';
import { drinkPageHref } from '@/lib/itemRoutes';
import { withAlpha } from '@/lib/color';
import { plural } from '@/lib/menus';
import { ingredientsLine } from '@/lib/publicDrink';
import type { MenuDrink } from '@/types/menus';

import { ReportSheet } from '../safety/ReportSheet';
import { Kicker, PublicPage } from './PublicChrome';
import { loadFailure, PublicMissing } from './PublicShell';
import { SaveToMake } from './SaveToMake';

const PRIVATE = 'private:';
/** How many drawings sit across the header. */
const STRIP = 4;

/** "Saturday 31 October", the night the menu is for (a date with no time zone). */
export function menuNight(day: string, locale = 'en-GB'): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** A drink on the menu that isn't public: it holds its place, with no name. */
const privateDrink = (sectionId: string, index: number): MenuDrink => ({
  id: `${PRIVATE}${sectionId}:${index}`,
  name: 'House drink',
  kind: 'cocktail',
  line: 'Kept private',
  price: null,
  imageUrl: null,
  isSketch: false,
  glass: 'Martini',
});

/**
 * A home menu someone shared (/m/<id>), as a guest sees it (ppl-pub-menu-phone,
 * -desktop): a header on paper with a strip of the drinks' drawings, then the
 * drinks, each opening its page with a Save to make it at home, and the "Menu
 * made with Cocktail" card. Drinks that aren't public keep their place as
 * "House drink", never their names.
 */
export function SharedMenuScreen({ id }: { id: string }) {
  const router = useRouter();
  const wide = useBreakpoint() !== 'phone';
  const gutter = useGutter();
  const signedIn = useSignedIn();
  const query = useSharedMenu(id);
  const { data, isPending } = query;
  const [reporting, setReporting] = useState(false);
  if (!data) return <PublicMissing loading={isPending} what="menu" failed={loadFailure(query)} />;

  const { owner } = data;
  const drinks = data.sections.flatMap((s) => s.drinks);
  const sections = data.sections.map((s) => ({
    id: s.id,
    name: s.name,
    // Each drink's line is its ingredients ("Campari, sweet vermouth, soda, orange"), else its description.
    drinks: s.drinks.map((d, i) => {
      const drink = d && publishedMenuDrink(d);
      if (!drink) return privateDrink(s.id, i);
      return { ...drink, line: ingredientsLine(data.ingredients[drink.id] ?? []) ?? drink.line };
    }),
  }));
  const strip = sections.flatMap((s) => s.drinks).slice(0, STRIP);
  // Signed out, Report asks you to sign in first: a report needs an account.
  const report = (
    <PressableScale role="link" accessibilityLabel="Report this menu" onPress={() => (signedIn ? setReporting(true) : router.push('/auth/login'))} style={styles.start}>
      <Caption tone="muted" style={styles.underline}>
        Report this menu
      </Caption>
    </PressableScale>
  );
  const made = (
    <Surface style={styles.made}>
      <View style={styles.madeText}>
        <DsText variant="headline" style={{ fontFamily: displayFaces.instrument.regular }}>
          Menu made with Cocktail
        </DsText>
        <Caption tone="muted">Make one for your own night, with the drinks drawn for you.</Caption>
      </View>
      <Button label="Make yours" onPress={() => router.push('/menus/create')} />
    </Surface>
  );

  return (
    <PublicPage title={data.name}>
      {/* On paper, centred: wide, a panel; on a phone, edge to edge under the nav (ppl-pub-menu-desktop, -phone). */}
      <View style={[styles.header, wide ? styles.headerWide : [styles.headerPhone, { marginHorizontal: -gutter }], { backgroundColor: backbar.light.paper }]}>
        <PressableScale role="link" accessibilityLabel={`Shared by ${owner.name}, open their profile`} onPress={() => router.push(`/p/${owner.handle}`)} style={styles.start}>
          <View style={[styles.shared, { backgroundColor: withAlpha(backbar.light.ink, 0.1) }]}>
            <Caption color={backbar.light.ink}>{`Shared by ${owner.name}`}</Caption>
          </View>
        </PressableScale>
        {strip.length ? (
          // A quarter of 640 each, so a short menu's drawings stay centred over the name.
          <View style={[styles.strip, { maxWidth: (640 / STRIP) * strip.length }]} aria-hidden>
            {strip.map((d) => (
              <View key={d.id} style={styles.stripCell}>
                <StripDrawing drink={d} size={wide ? 120 : 76} />
              </View>
            ))}
          </View>
        ) : null}
        <DsText variant={wide ? 'display' : 'title'} role="heading" align="center" color={backbar.light.ink}>
          {data.name}
        </DsText>
        <Body align="center" color={backbar.light.muted}>
          {[data.menuDate ? menuNight(data.menuDate) : null, plural(drinks.length, 'drink')].filter(Boolean).join(' · ')}
        </Body>
        {strip.length ? <Caption color={backbar.light.muted}>Drawn from each drink’s spec</Caption> : null}
      </View>
      <View style={wide ? styles.columns : styles.stack}>
        <View style={[styles.list, wide && styles.listWide]}>
          {drinks.length ? (
            sections.map((s) => (
              <View key={s.id} style={styles.section}>
                <Kicker>{s.name || 'Drinks'}</Kicker>
                <View role="list">
                  {s.drinks.map((d) => (
                    <MenuRow key={d.id} drink={d} open={d.id.startsWith(PRIVATE) ? null : () => router.push(drinkPageHref(d.id, signedIn) as Href)} />
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Body tone="muted">No drinks on this menu yet.</Body>
          )}
          {drinks.length ? <Caption tone="muted">Tap a drink for its spec. Save it and it’s in your bar to make at home.</Caption> : null}
        </View>
        <View style={[styles.aside, wide && styles.asideWide]}>
          {made}
          {report}
        </View>
      </View>
      {reporting ? (
        <ReportSheet subject={data.name} targets={[{ label: `${owner.name}, who shared this menu`, target: { kind: 'profile', profileId: owner.profileId } }]} onClose={() => setReporting(false)} />
      ) : null}
    </PublicPage>
  );
}

/** A drawing in the header strip; a private drink's place is the plain martini line. */
function StripDrawing({ drink: d, size }: { drink: MenuDrink; size: number }) {
  if (d.id.startsWith(PRIVATE)) return <PrivateGlass size={size} />;
  return <DrinkImage source={d.imageUrl} generated={d.isSketch} itemId={d.id} glass={d.glass} accessibilityLabel={d.name} radius={0} style={{ width: size, height: size }} sketchDetail="thumb" />;
}

/** The thin martini line on paper, for a drink kept private. */
function PrivateGlass({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  return (
    <View style={[styles.privateGlass, { width: size, height: size, backgroundColor: ds.c.paper }, style]}>
      <CustomIcon name="Martini" size={Math.round(size * 0.55)} color={ds.c.sketchInk} />
    </View>
  );
}

/** One drink: its picture, name and line opening its page, and Save. A private one is just its place. */
function MenuRow({ drink: d, open }: { drink: MenuDrink; open: (() => void) | null }) {
  const ds = useDs();
  const text = (
    <>
      <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }} numberOfLines={1}>
        {d.name}
      </DsText>
      {d.line ? (
        <Caption tone="muted" numberOfLines={2}>
          {d.line}
        </Caption>
      ) : null}
    </>
  );
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {open ? (
        <DrinkImage source={d.imageUrl} generated={d.isSketch} itemId={d.id} glass={d.glass} accessibilityLabel={d.name} aspectRatio={56 / 64} radius="control" style={styles.thumb} thumb sketchDetail="thumb" />
      ) : (
        <PrivateGlass size={56} style={styles.privateThumb} />
      )}
      {open ? (
        <PressableScale role="link" accessibilityLabel={[d.name, d.line].filter(Boolean).join('. ')} onPress={open} style={styles.rowText}>
          {text}
        </PressableScale>
      ) : (
        <View style={styles.rowText}>{text}</View>
      )}
      {open ? <SaveToMake itemId={d.id} name={d.name} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
  header: { alignItems: 'center', gap: space.xs + 2 },
  headerWide: { paddingVertical: space.xxl, paddingHorizontal: space.xxl + space.sm, borderRadius: radius.card },
  headerPhone: { marginTop: -space.sm, paddingTop: space.lg, paddingBottom: space.lg + space.xs, paddingHorizontal: space.lg, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  shared: { paddingVertical: space.xs, paddingHorizontal: space.sm + 2, borderRadius: radius.pill },
  strip: { flexDirection: 'row', gap: space.xs, width: '100%' },
  stripCell: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  privateGlass: { alignItems: 'center', justifyContent: 'center' },
  privateThumb: { height: 64, borderRadius: radius.control },
  underline: { textDecorationLine: 'underline' },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.xxl + space.sm },
  stack: { gap: space.xl },
  list: { gap: space.md },
  listWide: { flexGrow: 3, flexShrink: 1, flexBasis: 480, minWidth: 0 },
  aside: { gap: space.md },
  asideWide: { flexGrow: 2, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  section: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  made: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.lg },
  madeText: { flexGrow: 1, flexBasis: 200, gap: space.xs },
});
