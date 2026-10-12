import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { Crumbs, usePageFrame } from '@/components/nav/PageFrame';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useBarPublishing, useSetPublish } from '@/hooks/usePublishing';

import { PageVisibilityChoice } from './PageVisibilityChoice';

/** Venue settings › Publishing › Who sees your page (ppl-bar-visibility). */
export function PageVisibilityScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <Page barId={barId} />
    </BackbarTheme>
  );
}

function Page({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const frame = usePageFrame('text');
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';
  const canPublish = (useCapabilities(barId).data ?? []).includes('publish');
  const { data, isLoading } = useBarPublishing(barId);
  const set = useSetPublish(barId);
  const publishing = `/settings/bar/${barId}/publishing` as Href;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Who sees your page</title>
      </WebHead>
      <ScrollView contentContainerStyle={{ paddingTop: frame.wide ? frame.top : insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[frame.column, styles.readable]}>
          {frame.wide ? <Crumbs trail={[{ label: 'Publishing', href: publishing }]} /> : null}
          <Title role="heading">Who sees your page</Title>
          <Body tone="muted">{`For people outside ${venueName}. Your team always sees everything.`}</Body>
          {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {data?.profile ? (
            <PageVisibilityChoice
              heading={false}
              venueName={venueName}
              value={data.pageVisibility}
              disabled={!canPublish || set.isPending}
              error={set.error && set.variables?.level === 'page' ? set.error.message : null}
              onChange={(visibility) => set.mutate({ level: 'page', visibility })}
            />
          ) : data ? (
            <Body tone="muted">Nothing goes public until the venue has a public page.</Body>
          ) : null}
          {data && !canPublish ? <Caption tone="muted">You can look, but changing this needs the publish permission at this venue.</Caption> : null}
        </View>
      </ScrollView>
      {frame.wide ? null : (
        <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
          <GlassButton accessibilityLabel="Back to Publishing" label="Publishing" icon="chevron.left" onPress={() => (router.canGoBack() ? router.back() : router.replace(publishing))} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { gap: space.md },
  back: { position: 'absolute' },
});
