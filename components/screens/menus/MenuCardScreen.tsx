import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, DsText, GlassButton, PressableScale, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMenu } from '@/hooks/useMenus';
import { cardWhen, menuAsText } from '@/lib/menus';
import { shareText } from '@/lib/shareLink';

import { GuestCardContent } from './GuestCardContent';
import type { CardPictures } from './MenuSections';

const PICTURES: CardPictures[] = ['above', 'beside', 'none'];

/**
 * The guest menu: the same menu, typeset on paper with each drink's photo or
 * sketch, to print or share. The card is always paper in the light theme; in
 * the dark it sits as a paper sheet on the night ground (Miss-poster).
 */
export function MenuCardScreen({ menuId }: { menuId: string }) {
  const { venues } = useActiveVenue();
  const { data: menu } = useMenu(menuId);
  const venue = venues.find((v) => v.id === menu?.barId) ?? null;
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined}>
        <CardBody menuId={menuId} venue={venue} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function CardBody({ menuId, venue }: { menuId: string; venue: Venue | null }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { data: menu, isLoading } = useMenu(menuId);
  const web = Platform.OS === 'web';
  // The picture choice is the share review's "On the card" row; it arrives in the link.
  // ponytail: not saved per menu (that needs a column on menus); the share review passes it.
  const asked = useLocalSearchParams<{ pictures?: string }>().pictures;
  const pictures: CardPictures = PICTURES.find((p) => p === asked) ?? 'above';

  const share = () => {
    if (!menu) return;
    if (web) window.print();
    // ponytail: on a phone it shares the menu as text; the printed card (web) carries the QR codes.
    else void shareText(menuAsText(menu, venue?.name), menu.name, 'menu');
  };
  const dark = ds.scheme === 'dark';
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}`));
  const poster = () => menu && router.push(`/share/poster?menu=${menuId}`);
  return (
    // Paper, the sketches' own ground, so they sit on the page instead of in boxes; the night ground around a paper sheet in the dark.
    <View nativeID="menu-card-screen" style={[styles.screen, { backgroundColor: dark ? ds.c.ground : ds.c.paper }]}>
      {web ? <style>{'@media print { #menu-card-controls { display: none !important; } #menu-card-screen { background: transparent !important; } }'}</style> : null}
      {/* No app chrome (the sidebar hides here too): Back, then Poster and Print on the web, Poster and Share on a phone (Miss-poster). */}
      <View nativeID="menu-card-controls" style={[styles.controls, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        {web ? <GlassButton icon="chevron.left" label="Back" accessibilityLabel="Back to the menu" onPress={back} /> : <GlassButton icon="chevron.left" accessibilityLabel="Back to the menu" onPress={back} />}
        <View style={styles.end}>
          {/* The menu as a picture, in the bar's colour (Bet-poster). Android's is a tonal button. */}
          {Platform.OS === 'android' ? (
            <PressableScale role="button" accessibilityLabel="Poster" onPress={poster} style={[styles.tonal, { backgroundColor: withAlpha(ds.accentFill.fill, 0.18) }]}>
              <IconSymbol name="photo" size={18} color={ds.c.ink} />
              <DsText variant="caption" style={font.semiBold}>
                Poster
              </DsText>
            </PressableScale>
          ) : (
            <GlassButton icon="photo" label="Poster" accessibilityLabel="Poster" onPress={poster} />
          )}
          {web ? (
            <GlassButton icon="printer" label="Print" accessibilityLabel="Print it or save it as a PDF" onPress={share} />
          ) : Platform.OS === 'android' ? (
            <PressableScale role="button" accessibilityLabel="Share" onPress={share} style={styles.plain}>
              <IconSymbol name="square.and.arrow.up" size={22} color={ds.c.ink} />
            </PressableScale>
          ) : (
            <GlassButton icon="square.and.arrow.up" accessibilityLabel="Share" onPress={share} />
          )}
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={[styles.paper, dark && [styles.sheet, { backgroundColor: ds.c.paper, paddingHorizontal: web ? space.xxxl : space.lg }]]}>
          <BackbarTheme scheme="light">
            {!menu ? (
              <Body tone="muted">{isLoading ? 'Setting the menu…' : 'This menu isn’t there any more.'}</Body>
            ) : (
              <GuestCardContent name={menu.name} when={cardWhen(menu)} venue={venue} sections={menu.sections} pictures={pictures} />
            )}
          </BackbarTheme>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  end: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tonal: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill },
  plain: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  page: { alignItems: 'center', paddingTop: space.xl },
  paper: { width: '100%', maxWidth: 656 + 2 * space.xxxl, alignItems: 'center' },
  sheet: { borderRadius: radius.card, paddingTop: space.xxl, paddingBottom: space.xxl },
});
