import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassButton, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { Crumbs } from '@/components/nav/PageFrame';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useRunSheet } from '@/hooks/useRunSheet';
import { buildRunSheet, swappedRecipe } from '@/lib/runSheet';

import { STEPS, StepNav, usePartyLooks, type PartyLook, type Step } from './parts';
import { SendLists } from './SendLists';
import { ServesStep } from './ServesStep';
import { SheetPaper } from './SheetPaper';
import { SheetStep, useSheetActions } from './SheetStep';
import { SpecsStep } from './SpecsStep';
import { WhoStep } from './WhoStep';

/**
 * A menu's run sheet (canvas 7KusjjZLGZjbFd3B7oamZU): serves, swaps for this
 * menu, who brings what, and the sheet to print or share. Four steps on a
 * phone; on desktop the editor sits left and the sheet updates live on the right.
 */
export function RunSheetScreen({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const desktop = useBreakpoint() === 'desktop';
  const sidebar = useIsWideWeb();
  const userId = useUserId();
  const { data, isLoading, error } = useRunSheet(menuId);
  const caps = useCapabilities(data?.menu.barId);
  const [step, setStep] = useState<Step>('serves');
  const [breakDown, setBreakDown] = useState(false);
  const sheet = useMemo(() => (data ? buildRunSheet({ ...data, hostName: data.menu.hostName, breakDownPreps: breakDown }) : null), [data, breakDown]);
  const looks = usePartyLooks(data?.menu.hostName ?? '', data?.parties ?? []);
  const summaries = useMemo(
    () => Object.fromEntries((data?.drinks ?? []).map((d) => [d.id, swappedRecipe(d, data!.swaps).filter((l) => l.unit !== 'each').map((l) => l.name).join(', ')])),
    [data],
  );
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}` as Href));

  const canEdit = !!data && (data.menu.barId ? Array.isArray(caps.data) && caps.data.includes('menus') : data.menu.createdBy === userId);
  const shownStep = desktop && step === 'sheet' ? 'who' : step;
  const here = STEPS.findIndex((s) => s.value === shownStep);
  const nextStep = STEPS[here + 1] ? { value: STEPS[here + 1].value, next: STEPS[here].next } : null;
  const showNext = !!nextStep && !(desktop && nextStep.value === 'sheet');

  const body = !data || !sheet ? (
    <Body tone="muted">{isLoading ? 'Adding it up…' : error ? 'This menu isn’t there any more, or isn’t yours to plan.' : ''}</Body>
  ) : !canEdit && !caps.isLoading ? (
    <Body tone="muted">Only people who build menus here can plan the run sheet.</Body>
  ) : shownStep === 'serves' ? (
    <ServesStep data={data} total={sheet.totalServes} summaries={summaries} />
  ) : shownStep === 'specs' ? (
    <SpecsStep data={data} sheet={sheet} />
  ) : shownStep === 'who' ? (
    <WhoStep menuId={menuId} sheet={sheet} looks={looks} breakDown={breakDown} onBreakDown={setBreakDown} wide={desktop} />
  ) : (
    <SheetStep sheet={sheet} menu={data.menu} breakDown={breakDown} looks={looks} />
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {/* Before the scroll view, so a step's sheet (a dialog on the web) draws over it. */}
      {nextStep && showNext && canEdit && !desktop && data ? (
        <View style={[styles.next, { paddingHorizontal: gutter, bottom: insets.bottom + space.xl }]}>
          <Button label={nextStep.next} size="lg" onPress={() => setStep(nextStep.value)} />
        </View>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: sidebar ? space.xxl : insets.top + space.sm, paddingBottom: insets.bottom + 120 }]}
      >
        <View style={[styles.row, desktop ? styles.desktopRow : null]}>
          <View style={[styles.editor, desktop ? styles.editorWide : null]}>
            {sidebar ? (
              <Crumbs trail={[{ label: 'Menus', href: '/menus/all' }, { label: data?.menu.name ?? 'Menu', href: `/menus/${menuId}` }]} />
            ) : (
              <View style={styles.backRow}>
                <GlassButton icon="chevron.left" accessibilityLabel={`Back to ${data?.menu.name ?? 'the menu'}`} onPress={back} />
                <Caption tone="muted">{data?.menu.name ?? ''}</Caption>
              </View>
            )}
            <View style={{ gap: space.xs }}>
              <Title>Run sheet</Title>
              {shownStep === 'serves' ? <Body tone="muted">How many of each, and who brings what.</Body> : null}
            </View>
            {canEdit ? <StepNav step={shownStep} onChange={setStep} desktop={desktop} /> : null}
            {body}
            {nextStep && showNext && canEdit && desktop ? <Button label={nextStep.next} onPress={() => setStep(nextStep.value)} style={styles.nextInline} /> : null}
          </View>
          {desktop && data && sheet && canEdit ? <LivePreview sheet={sheet} menu={data.menu} breakDown={breakDown} looks={looks} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Desktop: the sheet beside the editor, updating as you go, and each bar's or brand's own list to send (boards "Desktop", R1). */
function LivePreview({ sheet, menu, breakDown, looks }: { sheet: ReturnType<typeof buildRunSheet>; menu: { id: string; name: string; startsAt: string | null; endsAt: string | null }; breakDown: boolean; looks: PartyLook[] }) {
  const a = useSheetActions(sheet, menu, breakDown);
  return (
    <View role="complementary" aria-label="Live preview of the run sheet" style={styles.preview}>
      <View style={styles.previewHead}>
        <Caption tone="muted" style={{ flex: 1 }}>The sheet · updates as you go</Caption>
        <Button label="Full size" size="sm" variant="secondary" onPress={a.openFull} />
        <Button label="Save PDF" size="sm" icon="printer" accessibilityHint="Opens the print dialog: pick Save as PDF" onPress={a.print} />
      </View>
      <SheetPaper sheet={sheet} menu={menu} variant="compact" />
      <SendLists sheet={sheet} menu={menu} looks={looks} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  row: { gap: space.xxl },
  desktopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  editor: { gap: space.xl, flex: 1, minWidth: 0 },
  editorWide: { maxWidth: 640 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  preview: { flex: 1, maxWidth: 460, minWidth: 0, gap: space.md },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  next: { position: 'absolute', left: 0, right: 0, zIndex: 1 },
  nextInline: { alignSelf: 'flex-start' },
});
