import { Redirect, useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Display, GlassButton, PencilState, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useStaffRound } from '@/hooks/useStaffRound';
import { firstName, houseMadeLine } from '@/lib/staffRound';

import { RoundNote, StepGroup, type StepRowData } from './StepGroup';

/**
 * "Your first round" (board Kept-onboard, 3): for a new bartender, three
 * things before their first shift. Read tonight's menu one drink at a time,
 * learn the house-made, log a batch with the bar's Admin. Keep going and Start
 * both pick up where they left off.
 */
export function StaffRoundScreen() {
  return (
    <BackbarTheme>
      <Round />
    </BackbarTheme>
  );
}

function Round() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const { active, isLoading } = useActiveVenue();
  const r = useStaffRound(active?.id ?? null);
  if (!active) return isLoading ? null : <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  const doneOf = (key: string) => r.steps.some((s) => s.key === key && s.done);
  const total = r.drinks.length;
  const nextDrink = r.drinks.find((d) => d.id === r.progress.next) ?? null;
  const nextHouse = r.houseMade.find((h) => h.id === r.nextHouseMade) ?? null;
  const openDrink = (id: string) => router.push(`/first-round/drink?id=${id}` as Href);
  const learn = () => {
    if (!nextHouse) return r.done('house_made');
    r.readHouseMade(nextHouse.id);
    router.push(`/ingredient/${nextHouse.id}` as Href);
  };
  // Log batch lives on the house-made's own page (and Tonight's Before doors).
  const logBatch = () => router.push((r.houseMade[0] ? `/ingredient/${r.houseMade[0].id}` : '/prep') as Href);
  const ready = () => router.push('/first-round/ready' as Href);

  const rows: StepRowData[] = [
    {
      key: 'read_menu',
      title: 'Read tonight’s menu',
      sub: r.menuName ? `${r.menuName} · ${total} ${total === 1 ? 'drink' : 'drinks'}` : 'Nothing on tonight yet',
      value: total && !doneOf('read_menu') ? `${r.progress.read} of ${total}` : null,
      done: doneOf('read_menu'),
      onPress: () => (nextDrink ? openDrink(nextDrink.id) : r.done('read_menu')),
    },
    { key: 'house_made', title: 'Learn the house-made', sub: houseMadeLine(r.houseMade.map((h) => h.name)) ?? 'Nothing house-made tonight', done: doneOf('house_made'), onPress: learn },
    { key: 'log_batch', title: r.setter ? `Log a batch with ${firstName(r.setter)}` : 'Log a batch', sub: 'At the bar, on your first shift', done: doneOf('log_batch'), onPress: logBatch },
  ];
  // The one way on: the next drink, then the next house-made, then Ready.
  const move = nextDrink
    ? { label: `Keep going: the ${nextDrink.name}`, go: () => openDrink(nextDrink.id) }
    : nextHouse && !doneOf('house_made')
      ? { label: `Keep going: the ${nextHouse.name.toLowerCase()}`, go: learn }
      : { label: 'You’re ready', go: ready };
  const eyebrow = [active.name, r.day ? `before ${r.day === 'tonight' ? 'tonight' : r.day}` : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Your first round</title>
      </WebHead>
      <View style={[styles.top, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={back} />
        <GlassButton accessibilityLabel={`Start: ${move.label}`} icon="checkmark" label="Start" color={ds.accentText} onPress={move.go} />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.column}>
          <View style={styles.head}>
            <Caption tone="muted" style={styles.caps}>
              {eyebrow}
            </Caption>
            <Display>Your first round</Display>
            <Body tone="muted">Three things, about ten minutes.</Body>
          </View>
          {r.isLoading ? <PencilState kind="loading" title="Getting tonight’s menu" compact /> : <StepGroup rows={rows} label="Your first round" />}
          <RoundNote icon="person.2" text={`${r.setter ?? 'Your bar'} set these for new bartenders.`} />
          <Button label={move.label} variant="ink" size="lg" onPress={move.go} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: space.sm },
  scroll: { flexGrow: 1, paddingTop: space.xl },
  column: { width: '100%', maxWidth: 560, gap: space.lg },
  head: { gap: space.xs, paddingBottom: space.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
