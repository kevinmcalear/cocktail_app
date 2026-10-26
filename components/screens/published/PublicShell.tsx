import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, DrinkImage, GlassButton, useBreakpoint } from '@/components/ds';
import { space } from '@/constants/tokens';

import { CouldNotLoad, NotAvailable, type LoadFailure } from '../safety/NotAvailable';
import { PublicPage } from './PublicChrome';

interface PublicShellProps {
  title: string;
  imageUrl: string | null;
  generated?: boolean;
  glass?: string | null;
  /** The drink's id: with no picture, its drawn sketch. */
  itemId?: string | null;
  /** A page pushed in the app (a bar's menu): Back above the page, under the site nav. */
  onBack?: () => void;
  children: ReactNode;
}

/**
 * A public page with one picture (a release cover): the picture card in its
 * own column beside the page on wide screens, above it on phones.
 */
export function PublicShell({ title, imageUrl, generated, glass, itemId, onBack, children }: PublicShellProps) {
  const wide = useBreakpoint() !== 'phone';
  return (
    <PublicPage title={title}>
      {onBack ? (
        <View style={styles.back}>
          <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={onBack} />
        </View>
      ) : null}
      <View style={wide ? styles.row : styles.stack}>
        <View style={wide ? styles.pictureColumn : undefined}>
          <PublicPicture name={title} imageUrl={imageUrl} generated={generated} glass={glass} itemId={itemId} />
        </View>
        <View style={[styles.body, wide && styles.flex]}>{children}</View>
      </View>
    </PublicPage>
  );
}

/** The picture card on the house paper: 380 tall beside a page, 220 above one on a phone. */
export function PublicPicture({ name, imageUrl, generated, glass, itemId }: { name: string; imageUrl: string | null; generated?: boolean; glass?: string | null; itemId?: string | null }) {
  const wide = useBreakpoint() !== 'phone';
  return <DrinkImage source={imageUrl} generated={generated} glass={glass} itemId={itemId} accessibilityLabel={name} aspectRatio={0} style={{ height: wide ? 380 : 220 }} priority="high" />;
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
  back: { alignSelf: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  stack: { gap: space.lg },
  pictureColumn: { width: 320 },
  body: { gap: space.lg },
});
