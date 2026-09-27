import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Title, useDs } from '@/components/ds';
import { RankingsScreen } from '@/components/screens/rankings/RankingsScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { space } from '@/constants/tokens';
import { useBarProfile, useRankTarget } from '@/hooks/useRankings';
import { useRedesign } from '@/lib/flags';
import { rankedAs } from '@/lib/ranking';

/**
 * Rankings for a drink: my list for it and the best in an area. Redesign only.
 * `itemId` can be any drink; a bar's version of a classic shows the classic's
 * list ("Martinis"). Opened from the drink page; Discover and You link here too.
 */
export default function RankingsRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const redesign = useRedesign();
  const { data: target, error, refetch, isLoading } = useRankTarget(itemId);
  const { data: home, isLoading: homeLoading } = useBarProfile(target?.bar_id);

  if (!redesign) return <Redirect href="/" />;
  const list = target ? rankedAs(target) : null;
  let content;
  if (error) content = <ErrorState title="Couldn't load these rankings" onRetry={() => void refetch()} />;
  else if (!isLoading && !target) content = <Page message="It may have been removed, or it belongs to a bar you're not part of." />;
  else if (!list || (target?.bar_id && homeLoading)) content = <Page />;
  else content = <RankingsScreen rankedAs={list} home={home ?? null} />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: list ? `${list.name} rankings` : 'Rankings' }} />
      {content}
    </>
  );
}

/** Loading, or a drink we can't show: the page's own ground, so there's no flash of the old theme. */
function Page({ message }: { message?: string }) {
  return (
    <BackbarTheme>
      <Ground message={message} />
    </BackbarTheme>
  );
}

function Ground({ message }: { message?: string }) {
  const ds = useDs();
  return (
    <View style={[styles.ground, { backgroundColor: ds.c.ground }]} accessibilityLabel={message ? undefined : 'Loading rankings'}>
      {message ? (
        <>
          <Title>{"Couldn't find this drink"}</Title>
          <Body tone="muted">{message}</Body>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.sm },
});
