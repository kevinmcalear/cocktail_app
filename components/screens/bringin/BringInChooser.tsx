import * as Device from 'expo-device';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, PressableScale, Spec, Title, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useBringInPlace } from '@/hooks/useBringInPlace';
import { useLastBringIn } from '@/hooks/useBringInBatches';
import { isCleanText, isLink, localReading } from '@/lib/bringIn';
import { lastTimeLine } from '@/lib/bringInBatch';
import { peekClipboard, readClipboard, UNREAD_CLIP } from '@/lib/clipboardPeek';
import { withAlpha } from '@/lib/color';
import { pickReadFiles, snapReadFiles, sourcesFromFiles, type ReadFile } from '@/lib/readAnything';
import { useBringIn } from '@/store/useBringIn';

import { useStartBringIn } from './useStartBringIn';

/** "Looks like a recipe": what pasted text seems to be, said before it's read. */
function looksLikeText(text: string): string {
  if (isLink(text)) return 'Looks like a link';
  // Shorthand specs ("45 calvados, 15 pear") are read by AI, but they're still a recipe.
  if (!isCleanText(text)) return /\d+\s*[a-zA-Z]/.test(text) && text.split('\n').length <= 12 ? 'Looks like a recipe' : 'Looks like text to read';
  const reading = localReading(text);
  if (reading.kind === 'recipes') return reading.recipes.length === 1 ? 'Looks like a recipe' : `Looks like ${reading.recipes.length} recipes`;
  return 'Looks like a list';
}

function Tile({ icon, label, sub, onPress }: { icon: IconName; label: string; sub: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${label}. ${sub}`} onPress={onPress} style={[styles.tile, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <IconSymbol name={icon} size={26} color={ds.accentText} />
      <View>
        <Body style={styles.semibold}>{label}</Body>
        <Caption tone="muted">{sub}</Caption>
      </View>
    </PressableScale>
  );
}

function LinkRow({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={detail ? `${label} ${detail}` : label} onPress={onPress} style={[styles.linkRow, { borderBottomColor: ds.c.line }]}>
      <Body style={styles.flex} numberOfLines={1}>
        {label}
        {detail ? <Body tone="muted">{` ${detail}`}</Body> : null}
      </Body>
      <IconSymbol name="chevron.right" size={18} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * Bring in's ways in (canvas make-bringin-sheet): Snap, Photos and files, or
 * Paste; what's on the clipboard, ready to use; type a drink yourself; and
 * the last bring-in. The sheet and the empty /bring-in page both show it.
 */
export function BringInChooser({ onClose }: { onClose?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const place = useBringInPlace();
  const start = useStartBringIn();
  const last = useLastBringIn(place.barId).data ?? null;
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [clip, setClip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The simulator has no camera, and launching it there crashes the app.
  const camera = Platform.OS === 'web' || Device.isDevice;

  useEffect(() => {
    let live = true;
    void peekClipboard().then((value) => live && setClip(value && (value === UNREAD_CLIP || value.length > 12) ? value : null));
    return () => {
      live = false;
    };
  }, []);

  const fromFiles = async (get: () => Promise<ReadFile[]>) => {
    setError(null);
    try {
      const files = await get();
      if (files.length) start(await sourcesFromFiles(files), { barId: place.barId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };
  const fromText = (value: string) => {
    if (value.trim()) start([{ files: [], text: value, url: null }], { barId: place.barId });
  };
  const go = (href: string) => {
    useBringIn.getState().closeSheet();
    onClose?.();
    router.push(href as Href);
  };

  if (pasting) {
    return (
      <View style={styles.stack}>
        <Title>Paste</Title>
        <Field label="Text or a link" value={text} onChangeText={setText} minLines={6} autoFocus placeholder={'Orchard Fizz\n45 calvados, 15 pear liqueur\n20 lemon, 15 honey 2:1, top soda'} />
        {text.trim() ? <Caption tone="muted">{looksLikeText(text)}</Caption> : null}
        <View style={styles.row}>
          <Button label="Back" variant="secondary" onPress={() => setPasting(false)} style={styles.flex} />
          <Button label="Read it" onPress={() => fromText(text)} disabled={!text.trim()} style={styles.wide} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <Title>Bring in</Title>
        <Body tone="muted">A menu, a recipe, a spec sheet, a shelf of bottles. Give it to us and we’ll work out what it is.</Body>
        {place.heldBack ? <Caption tone="muted">{`It comes into your home bar. Adding to ${place.heldBack} opens at Drink Creator.`}</Caption> : null}
      </View>
      <View style={styles.tiles}>
        {camera ? <Tile icon="camera" label="Snap" sub="Pages or a shelf" onPress={() => void fromFiles(snapReadFiles)} /> : null}
        <Tile icon="photo" label="Photos, files" sub="PDF, screenshots" onPress={() => void fromFiles(pickReadFiles)} />
        <Tile icon="doc.on.clipboard" label="Paste" sub="Text or a link" onPress={() => setPasting(true)} />
      </View>
      {clip ? (
        <View style={[styles.clip, { borderColor: withAlpha(ds.accentText, 0.55), backgroundColor: withAlpha(ds.accentText, 0.06) }]}>
          <View style={styles.clipHead}>
            <Caption style={styles.mono}>ON YOUR CLIPBOARD</Caption>
            {clip !== UNREAD_CLIP ? <Caption tone="muted">{looksLikeText(clip)}</Caption> : null}
          </View>
          {clip === UNREAD_CLIP ? <Body tone="muted">Something you copied. Use it to bring it in.</Body> : <Spec numberOfLines={3}>{clip}</Spec>}
          <Button label="Use it" onPress={() => void (clip === UNREAD_CLIP ? readClipboard().then((t) => t && fromText(t)) : Promise.resolve(fromText(clip)))} style={styles.end} />
        </View>
      ) : null}
      {error ? <Caption tone="accent">{error}</Caption> : null}
      <View style={[styles.links, { borderTopColor: ds.c.line }]}>
        <LinkRow label="Type a drink yourself" onPress={() => go(place.barId ? `/add-cocktail?barId=${place.barId}` : '/add-cocktail')} />
        {last ? <LinkRow label="Last time:" detail={lastTimeLine(last)} onPress={() => go(`/bring-in/done?batch=${last.id}`)} /> : null}
      </View>
      <Caption tone="muted">Photos and PDFs are read by AI. Clean text is read on your phone. You check everything before it saves.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl - 4 },
  head: { gap: space.xs + 2 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, minHeight: 112, paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.control + 4, borderWidth: 1, justifyContent: 'space-between' },
  semibold: { fontFamily: fontFamilies.bodyMedium },
  clip: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.control + 4, paddingVertical: space.md + 2, paddingHorizontal: space.lg, gap: space.sm + 2 },
  clipHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  mono: { fontFamily: fontFamilies.mono, letterSpacing: 0.5 },
  end: { alignSelf: 'flex-end' },
  links: { borderTopWidth: StyleSheet.hairlineWidth },
  linkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  wide: { flex: 2 },
  row: { flexDirection: 'row', gap: space.sm + 2 },
});
