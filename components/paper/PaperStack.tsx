import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { printPaper, radius, space } from '@/constants/tokens';
import type { Paper, PaperPage as Page } from '@/lib/paper/page';
import type { SketchInputs } from '@/lib/sketch/types';

import { PaperPage } from './PaperPage';

type PageView = ComponentRef<typeof View>;

// Pages are laid out at their paper's width in points and scaled down to fit: a picture taken for print stays sharp.
const LAID_OUT: Record<Paper, number> = { letter: 612, label: 340 };

interface PaperStackProps {
  pages: Page[];
  paper: Paper;
  /** How wide each page shows. */
  width: number;
  sketches?: Record<string, SketchInputs | null | undefined>;
  /** Each page's own view, in order, to print (lib/paper/printOut) once all have painted. */
  onReady: (views: PageView[] | null) => void;
}

/** Drawn pages one under another, each as a sheet of paper scaled to `width`, as the print preview shows them (Bet-print). */
export function PaperStack({ pages, paper, width, sketches = {}, onReady }: PaperStackProps) {
  const ds = useDs();
  const views = useRef<(PageView | null)[]>([]);
  const [painted, setPainted] = useState<boolean[]>([]);
  const count = pages.length;
  const all = count > 0 && painted.length >= count && painted.slice(0, count).every(Boolean);
  useEffect(() => {
    const live = views.current.slice(0, count).filter((v): v is PageView => !!v);
    onReady(all && live.length === count ? live : null);
  }, [all, count, onReady]);
  // Gone (another sheet, or a waiting state, took its place): nothing of it is left to print.
  useEffect(() => () => onReady(null), [onReady]);
  const mark = useCallback((i: number, p: boolean) => setPainted((was) => (was[i] === p ? was : Object.assign([...was], { [i]: p }))), []);

  return (
    <View style={styles.stack}>
      {pages.map((page, i) => {
        const unit = LAID_OUT[paper] / page.w;
        const scale = width / LAID_OUT[paper];
        return (
          <View key={i} style={[styles.sheet, { width, height: page.h * unit * scale, borderColor: ds.scheme === 'dark' ? 'transparent' : printPaper.hairline, backgroundColor: page.ground }]}>
            <View style={{ transform: [{ scale }], transformOrigin: 'left top' }}>
              <PaperPage
                ref={(v) => {
                  views.current[i] = v;
                }}
                page={page}
                unit={unit}
                sketches={sketches}
                onPainted={(p) => mark(i, p)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  sheet: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.mark },
});
