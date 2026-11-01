import { ScrollView, StyleSheet, View } from 'react-native';

import { PencilState, useDs } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarDrinks } from '@/hooks/useHomeBar';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useServiceDate } from '@/hooks/useServiceDay';
import { tonightEyebrow } from '@/lib/tonight';

import { HomeTonight } from './HomeTonight';
import { NoVenue, StaffLists, StaffSide } from './StaffTonight';
import { TonightHead, TonightSky } from './TonightParts';
import { useStaffTonight } from './useStaffTonight';

/** The column beside the lists on wide web (Prod-desk-today). */
const SIDE = 340;

/**
 * Tonight, the first tab (decided 31 Oct 2026, renamed 1 Nov): one column,
 * nothing to set up. At a bar, the lists on now, Before doors (house-made
 * short for tonight, drinks coming off), Needs you for admins, Learn and the
 * week. At home, the week at bars you love, what your shelf makes and the
 * one bottle worth buying. Wide web puts the bar's side in its own column.
 */
export function TonightScreen() {
  const home = useMode().mode === 'home';
  const { active, isLoading } = useActiveVenue();
  // While the bars load, a staff member's page waits rather than saying they have no bar.
  if (!home && !active && isLoading)
    return (
      <Frame sky={[]} eyebrow="">
        <PencilState kind="loading" title="Loading tonight" compact />
      </Frame>
    );
  return home || !active ? <HomePage venueless={!home} /> : <StaffPage barId={active.id} />;
}

function Frame({ sky, eyebrow, children }: { sky: readonly string[]; eyebrow: string; children: React.ReactNode }) {
  const ds = useDs();
  const bottom = useTabBarInset();
  const wide = useIsWideWeb();
  const column = usePageColumn(wide ? 'wide' : 'text');
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <TonightSky ids={sky} />
        <ScreenHeader />
        <View style={[column, styles.body]}>
          <TonightHead eyebrow={eyebrow} />
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

function StaffPage({ barId }: { barId: string }) {
  const t = useStaffTonight(barId);
  const wide = useIsWideWeb();
  return (
    <Frame sky={t.heroIds} eyebrow={t.eyebrow}>
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.main}>
            <StaffLists t={t} barId={barId} wide />
          </View>
          <View style={styles.side}>
            <StaffSide t={t} barId={barId} />
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          <StaffLists t={t} barId={barId} wide={false} />
          <StaffSide t={t} barId={barId} />
        </View>
      )}
    </Frame>
  );
}

function HomePage({ venueless }: { venueless: boolean }) {
  const date = useServiceDate();
  // The sky takes the first drinks the shelf makes (the same query From your shelf reads).
  const sky = useBarDrinks(!venueless).canMake.slice(0, 3).map((d) => d.id);
  return (
    <Frame sky={sky} eyebrow={date ? tonightEyebrow(date, null) : ''}>
      {venueless ? <NoVenue /> : <HomeTonight />}
    </Frame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.lg },
  stack: { gap: space.xl },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxxl },
  main: { flex: 1, minWidth: 0 },
  side: { width: SIDE, paddingTop: space.xl },
});
