import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Caption, DsText, GlassButton, LogoImage, PressableScale, useDs, useGutter } from '@/components/ds';
import { logoFill } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMenu } from '@/hooks/useMenus';
import { cardWhen, menuAsText } from '@/lib/menus';
import type { MenuSectionDetail } from '@/types/menus';

import { MenuSections, type CardPictures } from './MenuSections';

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

/** The venue's logo, or its initial in the display italic on its accent, small at the card's foot. */
function VenueMark({ venue }: { venue: Venue }) {
  const ds = useDs();
  if (venue.logoUrl) {
    return <LogoImage uri={venue.logoUrl} size={styles.mark.width} radius={styles.mark.borderRadius} fill={logoFill(venue)} />;
  }
  return (
    <View style={[styles.mark, { backgroundColor: ds.accentFill.fill }]} aria-hidden>
      <DsText variant="body" color={ds.accentFill.text} style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
        {venue.name.slice(0, 1)}
      </DsText>
    </View>
  );
}

interface GuestCardContentProps {
  name: string;
  /** The eyebrow: "Friday 31 October", "From Mon 1 December" (lib/menus cardWhen). */
  when: string | null;
  venue: Venue | null;
  sections: Pick<MenuSectionDetail, 'id' | 'name' | 'drinks'>[];
  pictures: CardPictures;
  /** Smaller type and pictures: the editor's live preview beside the menu. */
  compact?: boolean;
  /** Drinks not made yet (New menu's pasted list), marked NEW and not drawn. */
  newIds?: ReadonlySet<string>;
}

/**
 * The card itself: when (an eyebrow), the menu's name in the display face, "at
 * Little Rye" in italic, a rule, its sections with a QR code under each drink
 * that opens its page, and a foot: the drawings note, "Scan a code to open the
 * drink" and the venue's mark. The editor's preview (`compact`) is just when,
 * name and sections. Inside the light theme, on paper.
 */
export function GuestCardContent({ name, when, venue, sections, pictures, compact = false, newIds }: GuestCardContentProps) {
  const ds = useDs();
  return (
    <View style={styles.card}>
      {when ? (
        <Caption tone="muted" style={styles.eyebrow}>
          {when.toUpperCase()}
        </Caption>
      ) : null}
      <DsText variant={compact ? 'title' : 'display'} role="heading" align="center">
        {name}
      </DsText>
      {venue && !compact ? (
        <DsText variant="headline" align="center" tone="muted" style={[styles.at, { fontFamily: displayFaces[ds.displayFace].italic }]}>
          {`at ${venue.name}`}
        </DsText>
      ) : null}
      <View style={[styles.rule, compact && styles.ruleCompact, { backgroundColor: ds.c.lineStrong }]} />
      {/* Each section's own name heads it (a one-section menu's "Drinks" included): no extra heading. */}
      <View style={styles.sections}>
        <MenuSections
          sections={sections}
          variant="card"
          pictures={pictures}
          newIds={newIds}
          compact={compact}
          codes={!compact}
          foot={
            compact ? undefined : (
              <View style={styles.scan}>
                <Caption tone="muted">Scan a code to open the drink</Caption>
                {venue ? <VenueMark venue={venue} /> : null}
              </View>
            )
          }
        />
      </View>
    </View>
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
    else void Share.share({ message: menuAsText(menu, venue?.name) });
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
  card: { width: '100%', maxWidth: 656, alignItems: 'center', gap: space.sm },
  mark: { width: 28, height: 28, borderRadius: radius.mark * 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scan: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  eyebrow: { ...font.figures, letterSpacing: 1.5, textAlign: 'center' },
  at: { marginTop: -space.xs },
  rule: { width: 48, height: 1, marginVertical: space.lg },
  ruleCompact: { marginVertical: space.sm },
  sections: { width: '100%' },
});
