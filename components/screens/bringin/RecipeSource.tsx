import { StyleSheet, View } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { ReadFile } from '@/lib/readAnything';
import type { SketchInputs } from '@/lib/sketch/types';
import type { ReadBox } from '@/supabase/functions/_shared/anythingRead';

import { SourceCrop } from './PagePicture';

/**
 * The drink drawn from the spec it was read with (canvas eddie-oct22-wave1,
 * Fix 8): what it starts as, not a picture of the page. The bar adds photos
 * on the drink's page when it wants them.
 */
export function DrawnFromSpec({ inputs, seed, name, compact }: { inputs: SketchInputs; seed: string; name: string; compact?: boolean }) {
  const ds = useDs();
  return (
    <View role="img" aria-label={`Drawing of ${name || 'the drink'}, drawn from the spec`} style={[styles.paper, compact && styles.small, { backgroundColor: ds.c.paper }]}>
      <View style={compact ? styles.drawingSmall : styles.drawing}>
        <SketchDrawing inputs={inputs} seed={seed} detail="full" />
      </View>
      {/* Beside the name (the desktop review), the line under the name says it. */}
      {compact ? null : (
        <Caption color={ds.c.sketchInk} style={styles.label}>
          Drawn from the spec
        </Caption>
      )}
    </View>
  );
}

/**
 * The bit of the file the drink was read from, small and labelled, so a
 * number can be checked against the page. A photo opens bigger; a PDF can't
 * be drawn here, so it shows the words read and the file's name.
 */
export function FromYourFile({ file, box, words, page, onLook }: { file: ReadFile; box: ReadBox; words: string; page: number | null; onLook: () => void }) {
  const ds = useDs();
  const photo = file.mimeType.startsWith('image/');
  const where = !photo ? (file.name ?? 'A PDF') : page === null ? 'Tap to see it bigger' : `Page ${page} · tap to see it bigger`;
  const body = (
    <>
      <SourceCrop file={file} box={box} words={words} width={92} height={44} />
      <View style={styles.flex}>
        <Caption style={styles.title}>From your file</Caption>
        <Caption tone="muted" numberOfLines={1}>
          {where}
        </Caption>
      </View>
    </>
  );
  const frame = [styles.row, { backgroundColor: ds.c.surface }];
  if (!photo) return <View style={frame}>{body}</View>;
  return (
    <PressableScale role="button" accessibilityLabel="From your file. See it bigger" onPress={onLook} style={frame}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  paper: { height: 210, paddingBottom: space.lg, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  drawing: { width: 168, height: 168 },
  small: { width: 150, height: 170, paddingBottom: 0, flexShrink: 0 },
  drawingSmall: { width: 130, height: 130 },
  label: { position: 'absolute', left: space.md, bottom: space.md, fontFamily: fontFamilies.mono },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 2, borderRadius: radius.control },
  title: { fontFamily: fontFamilies.bodySemiBold },
  flex: { flex: 1 },
});
