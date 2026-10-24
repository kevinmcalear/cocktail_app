import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';

type PageProps = { barId: string; title: string; intro?: string; children: ReactNode; crumb?: boolean };

/**
 * A page under a venue's settings (Ice, Tools, Suppliers): its title, the
 * "Venue settings" crumb, an intro and the content. Features sits beside
 * Venue settings in the menus, so it has no crumb (`crumb={false}`).
 */
export function VenueSubPage({ barId, title, intro, children, crumb = true }: PageProps) {
  return (
    <BackbarTheme>
      <Page barId={barId} title={title} intro={intro} crumb={crumb}>
        {children}
      </Page>
    </BackbarTheme>
  );
}

function Page({ barId, title, intro, children, crumb }: PageProps) {
  const ds = useDs();
  const router = useRouter();
  const frame = usePageFrame('text');
  const gutter = useGutter();
  const tabBarInset = useTabBarInset();
  const settings = `/settings/bar/${barId}` as Href;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{title}</title>
      </WebHead>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: frame.top, paddingBottom: tabBarInset + space.xxxl, paddingHorizontal: gutter }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[frame.column, styles.readable]}>
          {/* On wide web the sidebar is the way around: the "Venue settings" crumb, no Back. */}
          <SubPageHead title={title} crumbs={crumb ? [{ label: 'Venue settings', href: settings }] : undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace(settings))} />
          {intro ? <Body tone="muted">{intro}</Body> : null}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { gap: space.lg },
});
