import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, DsText, GlassButton, useDs, useGutter } from '@/components/ds';
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

function VenueMark({ venue }: { venue: Venue }) {
  const ds = useDs();
  if (venue.logoUrl) {
    return <Image source={{ uri: venue.logoUrl }} style={styles.mark} contentFit="cover" accessible={false} />;
  }
  return (
    <View style={[styles.mark, { backgroundColor: ds.accentFill.fill }]}>
      <DsText variant="headline" color={ds.accentFill.text}>
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
 * Little Rye" in italic, a rule, its sections, and the venue's mark at the
 * foot. The editor's preview (`compact`) is just when, name and sections.
 * Inside the light theme, on paper.
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
      {/* A one-section menu named Drinks already says it. */}
      {compact || sections.some((sec) => /^drinks$/i.test(sec.name.trim())) ? null : (
        <Caption tone="muted" style={styles.eyebrow}>
          DRINKS
        </Caption>
      )}
      <View style={styles.sections}>
        <MenuSections sections={sections} variant="card" pictures={pictures} compact={compact} />
      </View>
      {venue && !compact ? (
        <View style={styles.foot}>
          <VenueMark venue={venue} />
        </View>
      ) : null}
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
    // ponytail: shares the menu as text. A share image with a QR code waits
    // on public menus (the publishing step): today a guest couldn't open the link.
    else void Share.share({ message: menuAsText(menu, venue?.name) });
  };
  return (
    // Paper, the sketches' own ground, so they sit on the page instead of in boxes.
    <View style={[styles.screen, { backgroundColor: ds.c.paper }]}>
      {web ? <style>{'@media print { #menu-card-controls { display: none !important; } }'}</style> : null}
      <View nativeID="menu-card-controls" style={[styles.controls, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back to the menu" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}`))} />
        <Button label={web ? 'Print or save as PDF' : 'Share'} icon={web ? 'printer' : 'square.and.arrow.up'} variant="secondary" onPress={share} disabled={!menu} />
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
  card: { width: '100%', maxWidth: 640, alignItems: 'center', gap: space.sm },
  mark: { width: 48, height: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.5, textAlign: 'center' },
  at: { marginTop: -space.xs },
  foot: { paddingTop: space.xl, alignItems: 'center' },
  rule: { width: 48, height: 1, marginVertical: space.lg },
  ruleCompact: { marginVertical: space.sm },
  sections: { width: '100%' },
});
