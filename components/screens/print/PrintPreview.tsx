import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Button, GlassButton, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';

import { PrintPagesView, usePrintSheet } from './PrintPages';
import { SHEETS, type SheetKind } from './sheets';

// About a Letter sheet's width at reading size; a phone shows it at its own width.
const WIDEST = 640;

/**
 * One row of the print set as it will print (Bet-print "The list on now",
 * "Run sheet"): Back, then Print, over the sheets on paper. `?print=1`
 * opens the print sheet once the pages have painted (the row's own Print).
 */
export function PrintPreview({ menuId, kind }: { menuId: string; kind: SheetKind }) {
  return (
    <BackbarTheme>
      <PreviewBody menuId={menuId} kind={kind} />
    </BackbarTheme>
  );
}

function PreviewBody({ menuId, kind }: { menuId: string; kind: SheetKind }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { width } = useWindowDimensions();
  const sheet = usePrintSheet(menuId, kind);
  const auto = useLocalSearchParams<{ print?: string }>().print === '1';
  const printed = useRef(false);
  useEffect(() => {
    if (!auto || printed.current || !sheet.canPrint) return;
    printed.current = true;
    void sheet.print();
  }, [auto, sheet]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/print?menu=${menuId}` as Href));
  const pageW = Math.min(width - 2 * gutter, WIDEST);
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back to Print" onPress={back} />
        <Button label="Print" variant="ink" size="sm" icon="printer" accessibilityLabel={`Print ${SHEETS[kind].label.toLowerCase()}`} disabled={!sheet.canPrint} onPress={() => void sheet.print()} />
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={{ width: pageW }}>
          <PrintPagesView kind={kind} sheet={sheet} width={pageW} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: space.sm },
  page: { alignItems: 'center', paddingTop: space.md },
});
