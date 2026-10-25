import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';

type PageProps = {
  barId: string;
  title: string;
  intro?: string;
  children: ReactNode;
  crumb?: boolean;
  /** Up a level to somewhere else than Venue settings: a glass's page goes back to Glassware. */
  up?: { label: string; href: Href };
  /** The wide page's width: Kit's list with the open thing beside it. */
  wide?: boolean;
};

/**
 * A page under a venue's settings (Ice, Tools, Suppliers): its title, the
 * "Venue settings" crumb, an intro and the content. Features sits beside
 * Venue settings in the menus, so it has no crumb (`crumb={false}`).
 */
export function VenueSubPage(props: PageProps) {
  return (
    <BackbarTheme>
      <Page {...props} crumb={props.crumb ?? true} />
    </BackbarTheme>
  );
}

function Page({ barId, title, intro, children, crumb, up, wide }: PageProps) {
  const ds = useDs();
  const router = useRouter();
  const frame = usePageFrame(wide ? 'wide' : 'text');
  const gutter = useGutter();
  const tabBarInset = useTabBarInset();
  const settings = `/settings/bar/${barId}` as Href;
  const crumbs = [{ label: 'Venue settings', href: settings }, ...(up ? [up] : [])];
  const back = up?.href ?? settings;
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
          <SubPageHead title={title} crumbs={crumb ? crumbs : undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace(back))} />
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
