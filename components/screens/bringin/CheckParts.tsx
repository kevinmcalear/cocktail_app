import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DsText, GlassButton, PressableScale, Sheet, Title, useDs, useGutter } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { ReadKind } from '@/lib/bringIn';
import type { ReadFile } from '@/lib/readAnything';
import type { ReadPlace } from '@/supabase/functions/_shared/anythingRead';

import { PagePicture } from './PagePicture';
import { ReadingAsChip } from './ReadingAsChip';

/** A check's top bar: Cancel (or a Close button) and the Reading as chip. */
export function CheckTop({ kind, onCancel, close }: { kind: ReadKind; onCancel: () => void; close?: boolean }) {
  const ds = useDs();
  return (
    <View style={styles.top}>
      {close ? (
        <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onCancel} />
      ) : (
        <PressableScale accessibilityLabel="Cancel" onPress={onCancel} style={styles.cancel}>
          <DsText variant="body" color={ds.c.muted}>
            Cancel
          </DsText>
        </PressableScale>
      )}
      <ReadingAsChip kind={kind} />
    </View>
  );
}

/** A small mono label ("MENU NAME", "SPEC", "PRICE"). */
export function MonoLabel({ children, style }: { children: string; style?: object }) {
  return (
    <Caption tone="muted" style={[styles.mono, style]}>
      {children}
    </Caption>
  );
}

/** The pinned footer: why the button waits (or what happens if nobody picks), then the buttons. */
export function CheckFooter({ note, children }: { note?: string | null; children: ReactNode }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <View style={[styles.footer, { backgroundColor: ds.c.ground, borderTopColor: ds.c.line, paddingBottom: insets.bottom + space.lg, paddingHorizontal: gutter }]}>
      <View style={styles.footerInner}>
        {note ? (
          <Caption tone="muted" align="center">
            {note}
          </Caption>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** "Show it on the page": the page with the line boxed. */
export function PageLook({ file, at, title, onClose }: { file: ReadFile | null; at: ReadPlace | null; title: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={!!file && !!at} onClose={onClose} accessibilityLabel={`${title} on the page`}>
      <View style={[styles.look, { paddingBottom: insets.bottom + space.xl }]}>
        <Title>On the page</Title>
        <Body tone="muted">{title}</Body>
        {file && at ? <PagePicture file={file} width={Math.min(width, 560) - space.xxl * 2} maxHeight={height * 0.6} marks={[{ box: at.box, dashed: false }]} /> : null}
        <Button label="Done" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** A labelled box with a plain input inside (MADE BY, SOURCE). */
export function BoxField({ label, children }: { label: string; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.box, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <MonoLabel>{label}</MonoLabel>
      {children}
    </View>
  );
}

export const checkStyles = StyleSheet.create({
  scroll: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg },
});

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  mono: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md + 2 },
  footerInner: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.sm },
  look: { paddingHorizontal: space.xl - 4, paddingTop: space.md, gap: space.md },
  box: { flex: 1, borderRadius: radius.control, borderWidth: 1, paddingVertical: space.sm, paddingHorizontal: space.md },
});
