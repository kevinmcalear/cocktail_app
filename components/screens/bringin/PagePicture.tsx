import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Caption, DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space } from '@/constants/tokens';
import { boxRect, cropLayout } from '@/lib/bringIn';
import { withAlpha } from '@/lib/color';
import type { ReadFile } from '@/lib/readAnything';
import type { ReadBox } from '@/supabase/functions/_shared/anythingRead';

/** A box drawn on the page: solid for something already yours, dashed for something new. */
export interface PageMark {
  box: ReadBox;
  dashed: boolean;
  /** A number over it (bottles on a shelf). */
  label?: string;
}

const isImage = (file: ReadFile | null | undefined) => !!file && file.mimeType.startsWith('image/');

/**
 * A page you gave Bring in, as paper: the photo at its own shape with what
 * was found boxed on it, or a card for a PDF or for text (which can't be
 * drawn here). `width` is the space it has.
 */
export function PagePicture({ file, text, width, maxHeight, marks = [], style }: { file?: ReadFile | null; text?: string | null; width: number; maxHeight: number; marks?: PageMark[]; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  if (isImage(file)) {
    const ratio = size ? size.height / size.width : 1.3;
    const w = Math.min(width, maxHeight / ratio);
    const frame = { width: w, height: w * ratio };
    return (
      <View style={[styles.page, frame, { backgroundColor: ds.c.paper }, style]} role="img" aria-label="The page being read">
        <Image source={{ uri: file!.uri }} contentFit="cover" style={StyleSheet.absoluteFill} onLoad={(e) => setSize({ width: e.source.width, height: e.source.height })} />
        {size
          ? marks.map((mark, i) => (
              <View key={i} aria-hidden style={[styles.mark, boxRect(mark.box, frame), { borderColor: ds.accentText, borderStyle: mark.dashed ? 'dashed' : 'solid', backgroundColor: withAlpha(ds.accentText, 0.14) }]}>
                {mark.label ? (
                  <View style={[styles.number, { backgroundColor: ds.accentText }]}>
                    <DsText variant="caption" color={ds.c.ground}>
                      {mark.label}
                    </DsText>
                  </View>
                ) : null}
              </View>
            ))
          : null}
      </View>
    );
  }
  const w = Math.min(width, 322);
  return (
    <View style={[styles.page, styles.card, { width: w, height: Math.min(maxHeight, w * 1.3), backgroundColor: ds.c.paper }, style]} role="img" aria-label="What you gave us">
      {file ? <IconSymbol name="doc.text" size={40} color={ds.c.sketchInk} /> : null}
      <DsText variant={file ? 'headline' : 'body'} color={ds.c.sketchInk} numberOfLines={file ? 2 : 14} align={file ? 'center' : undefined}>
        {file ? (file.name ?? 'A PDF') : text}
      </DsText>
      {file ? <Caption color={ds.c.sketchInk}>PDF</Caption> : null}
    </View>
  );
}

/**
 * The printed line beside a row (canvas make-bringin-menu): a crop of the
 * photo when the reader said where the line is, else the line's words on
 * paper, the way the board draws it.
 */
export function SourceCrop({ file, box, words, width = 64, height = 44, children }: { file?: ReadFile | null; box?: ReadBox | null; words: string; width?: number; height?: number; children?: ReactNode }) {
  const ds = useDs();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const frame = { width, height };
  const crop = isImage(file) && box ? box : null;
  return (
    <View aria-hidden style={[styles.crop, frame, { backgroundColor: ds.c.paper }]}>
      {crop ? (
        <Image
          source={{ uri: file!.uri }}
          contentFit="fill"
          style={[styles.abs, size ? cropLayout(crop, size, frame) : { width: 0, height: 0 }]}
          onLoad={(e) => setSize({ width: e.source.width, height: e.source.height })}
        />
      ) : (
        // Set like the printed menu (the venue's display face, which is narrow), so a name fits without breaking.
        <DsText variant="caption" color={ds.c.sketchInk} numberOfLines={3} style={[styles.words, { fontFamily: displayFaces[ds.displayFace].regular }]}>
          {words}
        </DsText>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { borderRadius: radius.mark, overflow: 'hidden', alignSelf: 'center' },
  card: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  mark: { position: 'absolute', borderWidth: 1.5, borderRadius: radius.mark },
  number: { position: 'absolute', top: -11, alignSelf: 'center', minWidth: 22, height: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  crop: { borderRadius: radius.mark, overflow: 'hidden', flexShrink: 0 },
  abs: { position: 'absolute' },
  words: { paddingVertical: 5, paddingHorizontal: 6, lineHeight: 15 },
});
