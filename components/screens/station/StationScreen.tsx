import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Caption, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useStationSheet } from '@/hooks/useServiceSpec';
import { useTonight } from '@/hooks/useTonight';
import { stationCard } from '@/lib/service';
import { specLines } from '@/lib/spec';

import { StationCard } from './StationCard';

interface Named {
  id: string;
  name: string;
}

/**
 * The station sheet: tonight's menu as a grid of service cards (pour, add,
 * method, glass, ice, garnish), big enough to read across the bar. Fills a
 * station tablet or a browser window and keeps the screen awake. One card
 * per drink; the same cards the drink page's Service section shows.
 */
export function StationScreen() {
  return (
    <BackbarTheme>
      <StationPage />
    </BackbarTheme>
  );
}

function StationPage() {
  useKeepAwake();
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const { active } = useActiveVenue();
  const { menus } = useTonight(active?.id ?? null);
  const { data: dropdowns } = useDropdowns();
  const { data: drinks, isLoading, error } = useStationSheet(active?.id, menus.map((m) => m.id));

  const cards = useMemo(() => {
    const name = (list: Named[] | undefined, id: string | null) => (id ? (list?.find((x) => x.id === id)?.name ?? null) : null);
    return (drinks ?? []).map((d) =>
      stationCard(
        {
          id: d.id,
          name: d.name,
          style: d.service_style,
          method: d.methodIds.map((id) => name(dropdowns?.methods as Named[], id)).find((n): n is string => !!n) ?? null,
          glass: name(dropdowns?.glassware as Named[], d.glassware_id),
          ice: name(dropdowns?.iceTypes as Named[], d.ice_id),
        },
        specLines(d.recipes)
      )
    );
  }, [drinks, dropdowns]);

  const columns = breakpoint === 'desktop' ? 3 : breakpoint === 'tablet' ? 2 : 1;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const title = menus.map((m) => m.name).join(' · ') || 'No current menu';

  let body: React.ReactNode;
  if (!active) body = <Body tone="muted">Once a venue adds you to its team, its station sheet shows here.</Body>;
  else if (menus.length === 0) body = <Body tone="muted">Set a current menu and its drinks show here as service cards.</Body>;
  else if (error) body = <Body tone="muted">Couldn’t load tonight’s drinks. Check your connection and try again.</Body>;
  else if (isLoading) body = <Caption tone="muted">Laying out the station…</Caption>;
  else if (cards.length === 0) body = <Body tone="muted">No cocktails on the current menu.</Body>;
  else
    body = (
      <View style={styles.grid} role="list">
        {cards.map((c) => (
          <View key={c.id} style={{ width: `${100 / columns}%`, padding: space.xs }}>
            <StationCard card={c} />
          </View>
        ))}
      </View>
    );

  return (
    <BrandProvider accent={active?.accent ?? undefined}>
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <View style={[styles.nav, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
          <GlassButton accessibilityLabel="Close the station sheet" icon="xmark" onPress={close} />
          <View style={styles.titles}>
            <Caption tone="muted" style={styles.eyebrow}>
              STATION SHEET
            </Caption>
            <Headline numberOfLines={1}>{title}</Headline>
          </View>
          <View style={styles.navSpacer} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter - space.xs, paddingTop: space.md, paddingBottom: insets.bottom + space.xxl }}>
          {body}
        </ScrollView>
      </View>
    </BrandProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  titles: { flex: 1, alignItems: 'center' },
  eyebrow: { letterSpacing: 1.2 },
  navSpacer: { width: layout.minTapTarget },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
});
