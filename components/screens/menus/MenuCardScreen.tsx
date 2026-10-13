import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, DsText, LogoImage, useDs, useGutter } from '@/components/ds';
import { logoFill } from '@/components/nav/VenueMarks';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMenu } from '@/hooks/useMenus';
import { cardWhen, menuAsText } from '@/lib/menus';
import type { MenuSectionDetail } from '@/types/menus';

import { MenuSections, type CardPictures } from './MenuSections';

const PICTURES: CardPictures[] = ['above', 'beside', 'none'];

/**
 * The guest menu: the same menu, typeset on paper with each drink's photo or
 * sketch, to print or share. Always the light theme, whatever the app is in.
 */
export function MenuCardScreen({ menuId }: { menuId: string }) {
  const { venues } = useActiveVenue();
  const { data: menu } = useMenu(menuId);
  const venue = venues.find((v) => v.id === menu?.barId) ?? null;
  return (
    <BackbarTheme scheme="light">
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
}

/**
 * The card itself: when (an eyebrow), the menu's name in the display face, "at
 * Little Rye" in italic, a rule, its sections with a QR code under each drink
 * that opens its page, and a foot: the drawings note, "Scan a code to open the
 * drink" and the venue's mark. The editor's preview (`compact`) is just when,
 * name and sections. Inside the light theme, on paper.
 */
export function GuestCardContent({ name, when, venue, sections, pictures, compact = false }: GuestCardContentProps) {
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
  return (
    // Paper, the sketches' own ground, so they sit on the page instead of in boxes.
    <View style={[styles.screen, { backgroundColor: ds.c.paper }]}>
      {web ? <style>{'@media print { #menu-card-controls { display: none !important; } }'}</style> : null}
      <View nativeID="menu-card-controls" style={[styles.controls, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        {/* A bare printable page: text Back and Print, no app chrome (the sidebar hides here too). */}
        <Button label="Back" variant="ghost" accessibilityLabel="Back to the menu" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}`))} />
        <Button label={web ? 'Print' : 'Share'} accessibilityHint={web ? 'Print it or save it as a PDF' : undefined} variant="secondary" onPress={share} disabled={!menu} />
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        {!menu ? (
          <Body tone="muted">{isLoading ? 'Setting the menu…' : 'This menu isn’t there any more.'}</Body>
        ) : (
          <GuestCardContent name={menu.name} when={cardWhen(menu)} venue={venue} sections={menu.sections} pictures={pictures} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  page: { alignItems: 'center', paddingTop: space.xl },
  card: { width: '100%', maxWidth: 656, alignItems: 'center', gap: space.sm },
  mark: { width: 28, height: 28, borderRadius: radius.mark * 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scan: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.5, textAlign: 'center' },
  at: { marginTop: -space.xs },
  rule: { width: 48, height: 1, marginVertical: space.lg },
  ruleCompact: { marginVertical: space.sm },
  sections: { width: '100%' },
});
