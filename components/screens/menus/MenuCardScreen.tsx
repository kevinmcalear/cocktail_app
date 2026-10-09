import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Chip, DsText, GlassButton, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMenu } from '@/hooks/useMenus';
import { menuAsText } from '@/lib/menus';
import type { MenuSectionDetail } from '@/types/menus';

import { MenuSections, type CardPictures } from './MenuSections';

const PICTURES: { value: CardPictures; label: string }[] = [
  { value: 'above', label: 'Above' },
  { value: 'beside', label: 'Beside' },
  { value: 'none', label: 'None' },
];

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
  startsAt: string | null;
  venue: Venue | null;
  sections: Pick<MenuSectionDetail, 'id' | 'name' | 'drinks'>[];
  pictures: CardPictures;
  /** Smaller type and pictures: the editor's live preview beside the menu. */
  compact?: boolean;
}

/** The card itself: the venue's mark, the menu's name and date, its sections. Inside the light theme, on paper. */
export function GuestCardContent({ name, startsAt, venue, sections, pictures, compact = false }: GuestCardContentProps) {
  const ds = useDs();
  const from = startsAt ? new Date(startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;
  return (
    <View style={styles.card}>
      {venue ? <VenueMark venue={venue} /> : null}
      {venue ? (
        <DsText variant="headline" align="center">
          {venue.name}
        </DsText>
      ) : null}
      <DsText variant={compact ? 'title' : 'display'} role="heading" align="center">
        {name}
      </DsText>
      {from ? <Caption tone="muted">From {from}</Caption> : null}
      <View style={[styles.rule, compact && styles.ruleCompact, { backgroundColor: ds.c.lineStrong }]} />
      <View style={styles.sections}>
        <MenuSections sections={sections} variant="card" pictures={pictures} compact={compact} />
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
  // ponytail: the picture choice lasts while the card is open. Saving it per menu needs a column on menus.
  const [pictures, setPictures] = useState<CardPictures>('above');

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
        <View style={styles.controlsEnd}>
          <View role="radiogroup" accessibilityLabel="Pictures" style={styles.pictures}>
            <Caption tone="muted">Pictures</Caption>
            {PICTURES.map((p) => (
              <Chip key={p.value} label={p.label} accessibilityLabel={`Pictures ${p.label.toLowerCase()}`} quiet selected={pictures === p.value} onPress={() => setPictures(p.value)} />
            ))}
          </View>
          <Button label={web ? 'Print or save as PDF' : 'Share'} icon={web ? undefined : 'square.and.arrow.up'} onPress={share} disabled={!menu} />
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        {!menu ? (
          <Body tone="muted">{isLoading ? 'Setting the menu…' : 'This menu isn’t there any more.'}</Body>
        ) : (
          <GuestCardContent name={menu.name} startsAt={menu.startsAt} venue={venue} sections={menu.sections} pictures={pictures} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  controlsEnd: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap-reverse', justifyContent: 'flex-end', alignItems: 'center', gap: space.md },
  pictures: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  page: { alignItems: 'center', paddingTop: space.xl },
  card: { width: '100%', maxWidth: 640, alignItems: 'center', gap: space.sm },
  mark: { width: 48, height: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rule: { width: 48, height: 1, marginVertical: space.lg },
  ruleCompact: { marginVertical: space.sm },
  sections: { width: '100%' },
});
