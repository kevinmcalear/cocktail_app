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
export function DrawnFromSpec({ inputs, seed, name }: { inputs: SketchInputs; seed: string; name: string }) {
  const ds = useDs();
  return (
    <View role="img" aria-label={`Drawing of ${name || 'the drink'}, drawn from the spec`} style={[styles.paper, { backgroundColor: ds.c.paper }]}>
      <View style={styles.drawing}>
        <SketchDrawing inputs={inputs} seed={seed} detail="full" />
      </View>
      <Caption color={ds.c.sketchInk} style={styles.label}>
        Drawn from the spec
      </Caption>
    </View>
  );
}

/**
 * The bit of the file the drink was read from, small and labelled, so a
 * number can be checked against the page. A photo opens bigger; a PDF can't
 * be drawn here, so it shows the words read and the file's name.
 */
export function FromYourFile({ file, box, words, page, title = 'From your file', onLook }: { file: ReadFile; box: ReadBox; words: string; page: number | null; title?: string; onLook: () => void }) {
  const ds = useDs();
  const photo = file.mimeType.startsWith('image/');
  const where = !photo ? (file.name ?? 'A PDF') : page === null ? 'Tap to see it bigger' : `Page ${page} · tap to see it bigger`;
  const body = (
    <>
      <SourceCrop file={file} box={box} words={words} width={92} height={44} />
      <View style={styles.flex}>
        <Caption style={styles.title} numberOfLines={1}>
          {title}
        </Caption>
        <Caption tone="muted" numberOfLines={1}>
          {where}
        </Caption>
      </View>
    </>
  );
  const frame = [styles.row, { backgroundColor: ds.c.surface }];
  if (!photo) return <View style={frame}>{body}</View>;
  return (
    <PressableScale role="button" accessibilityLabel={`${title}. See it bigger`} onPress={onLook} style={frame}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  paper: { height: 210, paddingBottom: space.lg, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  drawing: { width: 168, height: 168 },
  label: { position: 'absolute', left: space.md, bottom: space.md, fontFamily: fontFamilies.mono },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 2, borderRadius: radius.control },
  title: { fontFamily: fontFamilies.bodySemiBold },
  flex: { flex: 1 },
});
