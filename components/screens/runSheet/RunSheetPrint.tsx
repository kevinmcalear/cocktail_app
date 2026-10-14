import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, useDs, useGutter } from '@/components/ds';
import { printPaper, space } from '@/constants/tokens';
import { useRunSheet } from '@/hooks/useRunSheet';
import { buildRunSheet } from '@/lib/runSheet';

import { SheetPaper } from './SheetPaper';
import { useSheetActions } from './SheetStep';

// A4 with the page's own margins; the app's scroll boxes open up so every page prints, not just the first screenful.
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  #run-sheet-controls { display: none !important; }
  html, body, #root { height: auto !important; overflow: visible !important; color-scheme: light !important; background: ${printPaper.paper} !important; }
  #root * { overflow: visible !important; }
  #run-sheet-page { padding: 0 !important; }
  #run-sheet-screen, #run-sheet-page { background: ${printPaper.paper} !important; }
  [data-print-block] { break-inside: avoid; }
}`;

/**
 * The run sheet as a bare page (no sidebar), to print or save as a PDF from
 * the browser's print dialog, like the guest card. `?print=1` opens the
 * dialog once the sheet is ready. On a phone it shares as text.
 */
export function RunSheetPrint({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const params = useLocalSearchParams<{ print?: string; breakdown?: string }>();
  const { data, isLoading } = useRunSheet(menuId);
  const sheet = useMemo(() => (data ? buildRunSheet({ ...data, hostName: data.menu.hostName, breakDownPreps: params.breakdown === '1' }) : null), [data, params.breakdown]);
  const web = Platform.OS === 'web';
  const printed = useRef(false);

  useEffect(() => {
    if (!web || !sheet || params.print !== '1' || printed.current) return;
    printed.current = true;
    // After the sheet has painted (and its fonts), so the dialog shows it all.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [web, sheet, params.print]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}/run-sheet` as Href));
  return (
    <View nativeID="run-sheet-screen" style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {web ? <style>{PRINT_CSS}</style> : null}
      <View nativeID="run-sheet-controls" style={[styles.controls, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <Button label="Back" variant="ghost" accessibilityLabel="Back to the run sheet" onPress={back} />
        {sheet && data ? <Actions sheet={sheet} menu={data.menu} /> : null}
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]} nativeID="run-sheet-page">
        {sheet && data ? (
          <View style={styles.a4}>
            <SheetPaper sheet={sheet} menu={data.menu} />
          </View>
        ) : (
          <Body tone="muted">{isLoading ? 'Adding it up…' : 'This run sheet isn’t there any more.'}</Body>
        )}
      </ScrollView>
    </View>
  );
}

function Actions({ sheet, menu }: { sheet: NonNullable<ReturnType<typeof buildRunSheet>>; menu: { id: string; name: string; startsAt: string | null; endsAt: string | null } }) {
  const a = useSheetActions(sheet, menu);
  return a.web ? <Button label="Print or save as PDF" variant="secondary" icon="printer" onPress={() => window.print()} /> : <Button label="Share" variant="secondary" icon="square.and.arrow.up" onPress={a.share} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: space.sm },
  page: { alignItems: 'center' },
  // A4's width at 96 dpi: the preview reads like the paper.
  a4: { width: '100%', maxWidth: 794 },
});
