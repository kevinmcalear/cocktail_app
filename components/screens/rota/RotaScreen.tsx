import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassButton, PressableScale, TextLink, useDs, useToast } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useWebNav } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useSaveShifts, type Shift } from '@/hooks/useRota';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { newDraftId } from '@/lib/drinkWizard';
import { plural } from '@/lib/menus';
import { addDays, copyShifts, weekLine, type RotaChange } from '@/lib/rota';
import { canSeeTeam } from '@/lib/team';

import { GridKey, RotaGrid } from './RotaGrid';
import { AskNote, CloseWarning, EmptyWeek } from './RotaParts';
import { RotaPhone } from './RotaPhone';
import { ShiftSheet, type ShiftSheetOpen } from './ShiftSheet';
import { useRotaWeek, type RotaWeek } from './useRotaWeek';

/**
 * The rota (Kept-rota, Kept-rota-desk): who's on, who opens, who closes. The
 * bar's team read it; people with Staff write it. The week grid on a desktop
 * window, the week strip and each night on a phone or tablet.
 */
export function RotaScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hydrated = useIsHydrated();
  const home = useMode().mode === 'home';
  const { active } = useActiveVenue();
  const column = usePageColumn('full');
  if (hydrated && !home && active) return <Rota key={active.id} barId={active.id} barName={active.name} />;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <PageHeader title="Rota" display width="full" onBack={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
        {hydrated ? <Body tone="muted">The rota is part of a venue. Switch to your bar to see it.</Body> : null}
      </ScrollView>
    </View>
  );
}

const rowOf = ({ id, user_id, starts_at, ends_at, opens, closes, note }: Shift): RotaChange['rows'][number] => ({ id, user_id, starts_at, ends_at, opens, closes, note });

function Rota({ barId, barName }: { barId: string; barName: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const column = usePageColumn('full');
  const edit = useCanManageStaff(barId);
  // The crumb goes through My team only for someone the nav shows it to.
  const team = canSeeTeam(useEffectiveRole(barId));
  const grid = useWebNav() === 'sidebar';
  const r = useRotaWeek(barId, edit);
  const save = useSaveShifts(barId, () => toast.show({ title: 'Couldn’t save the rota', detail: 'It’s back as it was. Try again.', tone: 'error' }));
  const [sheet, setSheet] = useState<ShiftSheetOpen | null>(null);

  const add = (night = r.selected, userId?: string) => setSheet({ night, userId });
  const open = (shift: Shift) => setSheet({ shift, night: r.selected });
  const copy = (here: boolean) => {
    const from = here ? r.lastWeek : r.shifts;
    const existing = here ? r.shifts : r.nextWeek;
    // Not read yet: nothing to go on, so nothing to copy.
    if (!from || !existing) return;
    if (!from.length) return void toast.show({ title: here ? 'Last week has no shifts to copy' : 'This week has no shifts to copy' });
    const { rows, gone } = copyShifts({ from, days: 7, memberIds: r.people.map((p) => p.user_id), existing, newId: newDraftId, timeZone: r.timeZone });
    const left = gone ? `${plural(gone, 'shift')} left out: not on the team now.` : undefined;
    if (!rows.length) return void toast.show({ title: 'Those shifts are already on the rota', detail: left });
    save.mutate({ rows });
    toast.show({
      title: `${plural(rows.length, 'shift')} copied${here ? '' : ' to next week'}`,
      detail: left,
      action: { label: 'Undo', onPress: () => save.mutate({ removed: rows.map((row) => row.id) }) },
    });
  };
  const remove = (shift: Shift) => {
    save.mutate({ removed: [shift.id] });
    toast.show({ title: 'Shift deleted', action: { label: 'Undo', onPress: () => save.mutate({ rows: [rowOf(shift)] }) } });
  };

  const warning = edit && r.gaps[0] ? <CloseWarning day={r.gaps[0]} nameOf={r.nameOf} timeZone={r.timeZone} wide={grid} onPick={(s) => save.mutate({ rows: [{ ...rowOf(s), closes: true }] })} /> : null;
  const body = () => {
    if (r.failed) {
      return (
        <View style={styles.failed}>
          <Body tone="muted">The rota didn’t load.</Body>
          <TextLink label="Try again" onPress={r.retry} />
        </View>
      );
    }
    if (r.loading) return <ActivityIndicator color={ds.c.muted} accessibilityLabel="Loading the rota" />;
    if (!grid) return <RotaPhone r={r} edit={edit} warning={warning} onOpen={open} onAdd={() => add()} onCopyLast={() => copy(true)} onCopyNext={() => copy(false)} />;
    if (!r.shifts.length) return <EmptyWeek edit={edit} />;
    return (
      <>
        <GridKey />
        {warning}
        <RotaGrid r={r} edit={edit} onOpen={open} onAdd={add} />
        {edit ? null : <AskNote name={r.maker} />}
      </>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <PageHeader
          title="Rota"
          display
          width="full"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
          actionOnTop
          crumbs={[{ label: barName, href: '/' as Href }, ...(team ? [{ label: 'My team', href: '/team' as Href }] : [])]}
          above={<WeekLine barName={barName} r={r} />}
          action={
            !edit || r.failed ? null : grid ? (
              <>
                <Button label="Copy last week" icon="arrow.left.arrow.right" variant="secondary" onPress={() => copy(true)} />
                <Button label="Add a shift" icon="plus" onPress={() => add()} />
              </>
            ) : (
              <PressableScale role="button" accessibilityLabel="Add a shift" onPress={() => add()} style={[styles.add, { backgroundColor: ds.accentFill.fill }]}>
                <IconSymbol name="plus" size={20} color={ds.accentFill.text} />
              </PressableScale>
            )
          }
        />
        {body()}
      </ScrollView>
      {sheet ? <ShiftSheet open={sheet} barName={barName} people={r.people} timeZone={r.timeZone} onClose={() => setSheet(null)} onSave={(row) => save.mutate({ rows: [row] })} onDelete={remove} /> : null}
    </View>
  );
}

/** "Caretaker's · 27 Oct to 2 Nov", and the arrows to the weeks either side. */
function WeekLine({ barName, r }: { barName: string; r: RotaWeek }) {
  return (
    <View style={styles.weekLine}>
      <Caption tone="muted" style={styles.caps}>
        {`${barName} · ${weekLine(r.week)}`}
      </Caption>
      <GlassButton icon="chevron.left" size={32} accessibilityLabel="The week before" onPress={() => r.goToWeek(addDays(r.week, -7))} />
      <GlassButton icon="chevron.right" size={32} accessibilityLabel="The week after" onPress={() => r.goToWeek(addDays(r.week, 7))} />
      {r.week === r.thisWeek ? null : <TextLink label="This week" onPress={() => r.goToWeek(r.thisWeek)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  weekLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  add: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  failed: { gap: space.sm, alignItems: 'flex-start' },
});
