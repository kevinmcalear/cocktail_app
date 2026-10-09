import { useRouter } from 'expo-router';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { DrinkHero } from '@/components/screens/drink/DrinkHero';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';

import { CouldNotLoad, NotAvailable, type LoadFailure } from '../safety/NotAvailable';

interface PublicShellProps {
  title: string;
  imageUrl: string | null;
  generated?: boolean;
  glass?: string | null;
  /** The drink's id: with no picture, its drawn sketch (signed in; signed out it's the glass). */
  itemId?: string | null;
  children: ReactNode;
}

/**
 * The frame of a public page (a published drink, a release): the picture full
 * bleed with the page over it on phones, side by side on wide screens, like
 * the drink page. Opens signed out too.
 */
export function PublicShell(props: PublicShellProps) {
  return (
    <BackbarTheme>
      <WebHead>
        <title>{props.title}</title>
      </WebHead>
      <Frame {...props} />
    </BackbarTheme>
  );
}

function Frame({ title, imageUrl, generated, glass, itemId, children }: PublicShellProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { width, height } = useWindowDimensions();
  const heroHeight = wide ? height - insets.top : Math.min(width, height * 0.42);
  // Public pages show one picture: the drink's hero or the release cover.
  const pictures = imageUrl ? [{ url: imageUrl, isSketch: !!generated, isOutdated: false }] : [];
  const hero = <DrinkHero name={title} pictures={pictures} glass={glass ?? null} itemId={itemId} height={heroHeight} fade={!wide} />;
  const body = <View style={[styles.body, { paddingHorizontal: gutter }]}>{children}</View>;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <View style={styles.row}>
          <View style={styles.heroColumn}>{hero}</View>
          <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: space.xxxl }}>
            <View style={styles.readable}>{body}</View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
          {hero}
          <View style={{ marginTop: -space.xxl }}>{body}</View>
        </ScrollView>
      )}
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onMedia={!!imageUrl}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

type Loadable = Pick<UseQueryResult, 'isError' | 'refetch'>;

/** A public page's queries that failed, as one retry; null when none did. */
export function loadFailure(...queries: Loadable[]): LoadFailure | null {
  const failed = queries.filter((q) => q.isError);
  if (!failed.length) return null;
  return { retry: () => failed.forEach((q) => void q.refetch()) };
}

/**
 * While a public page loads; Couldn't load when a request failed (so a bad
 * connection never reads as the owner hiding it, or a block); else, when
 * what it points at isn't public, Not available.
 */
export function PublicMissing({ loading, what, failed }: { loading: boolean; what: 'drink' | 'release' | 'menu'; failed?: LoadFailure | null }) {
  if (failed) return <CouldNotLoad what={what} failed={failed} />;
  if (!loading) return <NotAvailable what={what} />;
  return (
    <PublicShell title="Loading" imageUrl={null}>
      <Body tone="muted" accessibilityLabel={`Loading ${what}`}>
        {''}
      </Body>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  heroColumn: { width: '42%' },
  readable: { maxWidth: 720, width: '100%' },
  body: { gap: space.lg },
  controls: { position: 'absolute' },
});
