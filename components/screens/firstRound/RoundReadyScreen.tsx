import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Display, useDs, useGutter } from '@/components/ds';
import { HeroTrio, TonightSky } from '@/components/screens/tonight/TonightParts';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useStaffRound } from '@/hooks/useStaffRound';

/** "You're ready for Friday.", or tonight, or no day when the rota hasn't got you on yet. */
export function readyTitle(day: string | null): string {
  return day ? `You’re ready for ${day}.` : 'You’re ready.';
}

/**
 * Ready (board Kept-onboard, 5): three of tonight's drinks, ready for your
 * next shift, who opens and closes it from the rota, and Go to Tonight.
 */
export function RoundReadyScreen() {
  return (
    <BackbarTheme>
      <Ready />
    </BackbarTheme>
  );
}

function Ready() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const r = useStaffRound(useActiveVenue().active?.id ?? null);
  const trio = r.ids.slice(0, 3);
  const tonight = () => router.replace('/' as Href);
  const title = readyTitle(r.day);
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{title}</title>
      </WebHead>
      <TonightSky ids={trio} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter, paddingTop: insets.top + space.xxxl * 2, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.column}>
          {trio.length ? <HeroTrio ids={trio} label="Tonight’s drinks, on Tonight" onPress={tonight} /> : null}
          <View style={styles.head}>
            <Display align="center">{title}</Display>
            <Body tone="muted" align="center">
              {[r.rota, 'The menu, specs and prep are on Tonight.'].filter(Boolean).join(' ')}
            </Body>
          </View>
          <Button label="Go to Tonight" variant="ink" size="lg" onPress={tonight} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, gap: space.xl },
  head: { gap: space.md, paddingHorizontal: space.sm },
});
