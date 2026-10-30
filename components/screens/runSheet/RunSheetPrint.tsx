import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, useDs, useGutter } from '@/components/ds';
import { printPaper, radius, space } from '@/constants/tokens';
import { useRunSheet } from '@/hooks/useRunSheet';
import { buildRunSheet, DEFAULT_MARGIN_PCT } from '@/lib/runSheet';
import { runSheetHtml } from '@/lib/runSheetHtml';

import { SheetPaper } from './SheetPaper';
import { useSheetActions } from './SheetStep';

/**
 * The run sheet as a bare page (no sidebar). On the web it's the same A4 page
 * a phone shares as a PDF (lib/runSheetHtml.ts), in a frame that prints on
 * its own, so the browser's Save as PDF gives that PDF. `?print=1` opens the
 * dialog once the sheet is ready. On a phone it's the sheet full size, to share.
 */
export function RunSheetPrint({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const params = useLocalSearchParams<{ print?: string; breakdown?: string; margin?: string }>();
  const { data, isLoading } = useRunSheet(menuId);
  const margin = params.margin != null && Number.isFinite(Number(params.margin)) ? Number(params.margin) : DEFAULT_MARGIN_PCT;
  const sheet = useMemo(
    () => (data ? buildRunSheet({ ...data, hostName: data.menu.hostName, hostLogoUrl: data.menu.hostLogoUrl, breakDownPreps: params.breakdown === '1', marginPct: margin }) : null),
    [data, params.breakdown, margin],
  );
  const web = Platform.OS === 'web';
  const html = useMemo(() => (web && sheet && data ? runSheetHtml(sheet, data.menu) : null), [web, sheet, data]);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(1123);
  const printed = useRef(false);
  const printFrame = () => frame.current?.contentWindow?.print();

  // The frame grows to its page, and `?print=1` opens the dialog once it (and its logos) has loaded.
  const onFrameLoad = () => {
    const doc = frame.current?.contentDocument;
    if (doc) setHeight(doc.documentElement.scrollHeight + 2);
    if (params.print !== '1' || printed.current) return;
    printed.current = true;
    setTimeout(printFrame, 200);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}/run-sheet` as Href));
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.controls, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <Button label="Back" variant="ghost" accessibilityLabel="Back to the run sheet" onPress={back} />
        {sheet && data ? web ? <Button label="Print or save as PDF" variant="secondary" icon="printer" onPress={printFrame} /> : <Actions sheet={sheet} menu={data.menu} /> : null}
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        {html ? (
          <View style={styles.a4}>
            <iframe ref={frame} title="Run sheet" srcDoc={html} onLoad={onFrameLoad} style={{ width: '100%', height, border: 0, borderRadius: radius.mark, background: printPaper.paper, display: 'block' }} />
          </View>
        ) : sheet && data ? (
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
  return <Button label={a.pdf ? 'Share PDF' : 'Share'} variant="secondary" icon="square.and.arrow.up" onPress={() => void a.share()} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: space.sm },
  page: { alignItems: 'center' },
  // A4's width at 96 dpi: the preview reads like the paper.
  a4: { width: '100%', maxWidth: 794 },
});
