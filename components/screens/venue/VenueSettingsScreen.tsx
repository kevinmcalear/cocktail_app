import { useRouter } from 'expo-router';
import { lazy, Suspense } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { roleLabel } from '@/lib/roles';

const BarInlineEditor = lazy(() => import('@/components/bar/BarInlineEditor').then((m) => ({ default: m.BarInlineEditor })));

/** A venue's settings on a page of their own: identity, brand, access, links, team. */
export function VenueSettingsScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <VenuePage barId={barId} />
    </BackbarTheme>
  );
}

function VenuePage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const name = venue?.name ?? 'Venue';
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{`${name} settings`}</title>
      </WebHead>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}
      >
        <View style={styles.page}>
          <View style={styles.head}>
            <GlassButton
              accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
              icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
            />
            <View style={styles.title}>
              <Title numberOfLines={1}>{name}</Title>
              {venue ? <Caption tone="muted">{`Venue settings · You’re ${roleLabel(venue.roleLevel)}`}</Caption> : null}
            </View>
          </View>
          <Suspense fallback={<ListRowsSkeleton rows={4} />}>
            <BarInlineEditor barId={barId} embedded />
          </Suspense>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  title: { flex: 1, gap: 2 },
});
