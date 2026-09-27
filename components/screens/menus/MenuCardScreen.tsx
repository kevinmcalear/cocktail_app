import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Display, DsText, GlassButton, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMenu } from '@/hooks/useMenus';
import { menuAsText } from '@/lib/menus';

import { MenuSections } from './MenuSections';

/**
 * The guest menu: the same menu, typeset on paper, to print or share.
 * Always the light theme, whatever the app is in.
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

function CardBody({ menuId, venue }: { menuId: string; venue: Venue | null }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { data: menu, isLoading } = useMenu(menuId);
  const web = Platform.OS === 'web';

  const share = () => {
    if (!menu) return;
    if (web) window.print();
    // ponytail: shares the menu as text. A share image with a QR code waits
    // on public menus (the publishing step): today a guest couldn't open the link.
    else void Share.share({ message: menuAsText(menu, venue?.name) });
  };
  const from = menu?.startsAt ? new Date(menu.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {web ? <style>{'@media print { #menu-card-controls { display: none !important; } }'}</style> : null}
      <View nativeID="menu-card-controls" style={[styles.controls, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back to the menu" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}`))} />
        <Button label={web ? 'Print or save as PDF' : 'Share'} icon={web ? undefined : 'square.and.arrow.up'} onPress={share} disabled={!menu} />
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        {!menu ? (
          <Body tone="muted">{isLoading ? 'Setting the menu…' : 'This menu isn’t there any more.'}</Body>
        ) : (
          <View style={styles.card}>
            {venue ? <VenueMark venue={venue} /> : null}
            {venue ? (
              <DsText variant="headline" align="center">
                {venue.name}
              </DsText>
            ) : null}
            <Display align="center">{menu.name}</Display>
            {from ? <Caption tone="muted">From {from}</Caption> : null}
            <View style={[styles.rule, { backgroundColor: ds.c.lineStrong }]} />
            <View style={styles.sections}>
              <MenuSections sections={menu.sections} variant="card" />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  page: { alignItems: 'center', paddingTop: space.xl },
  card: { width: '100%', maxWidth: 520, alignItems: 'center', gap: space.sm },
  mark: { width: 48, height: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rule: { width: 48, height: 1, marginVertical: space.lg },
  sections: { width: '100%' },
});
