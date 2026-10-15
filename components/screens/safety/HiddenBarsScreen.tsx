import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { fontFamilies, space } from '@/constants/tokens';
import { useHiddenBars, useHideBar, type HiddenBar } from '@/hooks/useHiddenBars';

import { SafetyPage } from './SafetyPage';

/** Settings › Hidden bars (tools-settings-hidden-bars): the bars kept off your Discover, and Show again. */
export function HiddenBarsScreen() {
  const { data: bars, isLoading, error } = useHiddenBars();
  return (
    <SafetyPage title="Hidden bars" intro="They stay off Discover’s map, lists and rankings. Search still finds them by name, and their pages stay open.">
      {error ? (
        <Body tone="muted">Couldn’t load the bars you’ve hidden. Check your connection and try again.</Body>
      ) : isLoading ? (
        <Caption tone="muted">Loading…</Caption>
      ) : bars?.length ? (
        <View role="list" aria-label="Hidden bars">
          {bars.map((b) => (
            <HiddenRow key={b.id} bar={b} />
          ))}
        </View>
      ) : (
        <Body tone="muted">You haven’t hidden any bars.</Body>
      )}
      <Caption tone="muted">To hide a bar, tap the eye beside its heart on Discover or its page.</Caption>
    </SafetyPage>
  );
}

function HiddenRow({ bar }: { bar: HiddenBar }) {
  const ds = useDs();
  const hideBar = useHideBar();
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <BarMark name={bar.name} logoUrl={bar.avatarUrl} profileId={bar.id} size={40} />
      <View style={styles.flex}>
        <Body numberOfLines={2} style={styles.name}>
          {bar.name}
        </Body>
        {bar.place ? <Caption tone="muted">{bar.place}</Caption> : null}
        {hideBar.error ? (
          <Caption tone="accent" role="alert">
            Couldn’t show it again. Try again.
          </Caption>
        ) : null}
      </View>
      <Button
        label={hideBar.isPending ? 'Showing…' : 'Show again'}
        accessibilityLabel={`Show ${bar.name} on Discover again`}
        variant="secondary"
        size="sm"
        disabled={hideBar.isPending}
        onPress={() => hideBar.mutate({ profileId: bar.id, hide: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamilies.bodySemiBold },
});
