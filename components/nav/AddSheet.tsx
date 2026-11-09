import { useRouter, type Href } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DsText, GlassButton, PressableScale, Sheet, sheetIsDialog, SheetScrollView, dragDismissesKeyboard, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, type } from '@/constants/tokens';
import { useDictation } from '@/hooks/useDictation';
import { addIntent, clipLine } from '@/lib/addIntent';
import { UNREAD_CLIP } from '@/lib/clipboardPeek';
import { isLink } from '@/lib/bringIn';

import { NewDrafts } from './NewDrafts';
import { useAddActions, useClipboardOffer } from './useAddActions';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Add (Prod-add-B, Kevin's pick 31 Oct 2026): one field first (a name, a
 * link or a description), what you just copied as one tap, then Snap and
 * Choose a photo or PDF, then what you left unfinished. A name opens a draft
 * in pencil; everything else is read by Bring in. Its last row, Something
 * else (Add-entry), opens New: a bottle, beer, wine, a house-made, a menu.
 */
/** A button's place in the window (measureInWindow): what Add grows out of. */
export type Frame = { x: number; y: number; width: number; height: number };

export function AddSheet({ visible, onClose, onMore, listen, from }: { visible: boolean; onClose: () => void; onMore: () => void; /** Start listening as it opens (Android's Say it). */ listen?: boolean; /** The + it grows from. */ from?: Frame | null }) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Add" keyboard from={from} floating={Platform.OS === 'ios'} style={sheetIsDialog ? styles.dialog : undefined} header={<Header />}>
      <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: sheetIsDialog ? space.lg : (Platform.OS === 'ios' ? Math.max(insets.bottom - space.sm * 2, 0) : insets.bottom) + space.lg }]} {...dragDismissesKeyboard}>
        <AddBody onClose={onClose} onMore={onMore} listen={listen} />
      </SheetScrollView>
    </Sheet>
  );
}

function Header() {
  const close = useSheetClose();
  return (
    <View style={styles.header}>
      {/* Android's sheets go back with an arrow (Prod-and); iOS and the web close with an X. */}
      <GlassButton icon={Platform.OS === 'android' ? 'arrow.left' : 'xmark'} accessibilityLabel={Platform.OS === 'android' ? 'Back' : 'Close'} onPress={close} />
      <DsText role="heading" style={styles.title}>
        Add
      </DsText>
      <View style={styles.side} />
    </View>
  );
}

function AddBody({ onClose, onMore, listen }: { onClose: () => void; onMore: () => void; listen?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const add = useAddActions(onClose);
  const clip = useClipboardOffer();
  const [text, setText] = useState('');
  const intent = addIntent(text);
  // What was typed before the mic: what's said carries on from it.
  const typed = useRef('');
  const voice = useDictation((heard) => setText(typed.current ? `${typed.current} ${heard}` : heard));
  const say = () => {
    typed.current = text.trim();
    void voice.start();
  };
  // Android's Say it opens the sheet listening.
  const listenOnOpen = useEffectEvent(() => {
    if (listen && voice.available) say();
  });
  useEffect(() => listenOnOpen(), []);
  const go = (href: Href) => {
    onClose();
    router.push(href);
  };
  const clipWords = clip === UNREAD_CLIP ? 'Use what you copied' : clip && isLink(clip) ? `Use the link you copied: ${clipLine(clip)}` : clip ? `Use what you copied: ${clipLine(clip)}` : null;

  return (
    <View style={styles.stack}>
      <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          submitBehavior="submit"
          returnKeyType="go"
          onSubmitEditing={() => add.submit(text)}
          // The web's multiline box takes Return as a new line: Return adds, Shift-Return breaks the line.
          onKeyPress={(e) => {
            if (Platform.OS !== 'web' || e.nativeEvent.key !== 'Enter' || (e.nativeEvent as { shiftKey?: boolean }).shiftKey) return;
            e.preventDefault();
            add.submit(text);
          }}
          placeholder="Name a drink, paste a link, or describe it"
          placeholderTextColor={ds.c.muted}
          aria-label="Name a drink, paste a link, or describe it"
          style={[styles.input, NO_OUTLINE, { color: ds.c.ink }]}
        />
        <View style={styles.tools}>
          {voice.available ? (
            <PressableScale
              role="button"
              accessibilityLabel={voice.listening ? 'Stop listening' : 'Say it'}
              aria-pressed={voice.listening}
              onPress={() => (voice.listening ? voice.stop() : say())}
              style={[styles.round, { backgroundColor: voice.listening ? ds.accentFill.fill : ds.c.raised }]}
            >
              <IconSymbol name="mic" size={19} color={voice.listening ? ds.accentFill.text : ds.c.ink} />
            </PressableScale>
          ) : null}
          {intent ? (
            <PressableScale role="button" accessibilityLabel={intent === 'name' ? `Start a drink called ${text.trim()}` : 'Read it'} onPress={() => add.submit(text)} style={[styles.round, { backgroundColor: ds.accentFill.fill }]}>
              <IconSymbol name="arrow.up" size={18} color={ds.accentFill.text} />
            </PressableScale>
          ) : null}
        </View>
      </View>
      {voice.listening ? <Caption tone="muted">Listening…</Caption> : voice.error ? <Caption tone="accent">{voice.error}</Caption> : null}
      {clipWords ? (
        <PressableScale role="button" accessibilityLabel={`${clipWords}. Paste`} onPress={() => void add.paste()} style={[styles.clip, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="doc.on.clipboard" size={18} color={ds.c.ink} />
          <Body numberOfLines={2} style={styles.flex}>
            {clipWords}
          </Body>
          <DsText variant="label" style={{ ...font.semiBold }}>
            Paste
          </DsText>
        </PressableScale>
      ) : null}
      <View style={styles.buttons}>
        {add.canSnap ? <Button label="Snap a menu, bottle or recipe" icon="camera" variant="ink" size="lg" onPress={add.snap} /> : null}
        <Button label="Choose a photo or PDF" icon="photo" variant="secondary" size="lg" onPress={add.choose} />
      </View>
      {add.error ? <Caption tone="accent">{add.error}</Caption> : null}
      {add.place.heldBack ? <Caption tone="muted">{`It comes into your home bar. Adding to ${add.place.heldBack} opens at Drink Creator.`}</Caption> : null}
      <NewDrafts
        barId={add.place.barId}
        onOpen={(params) => go({ pathname: '/add-cocktail', params })}
        onOpenKind={(kind) => go({ pathname: kind === 'house' ? '/make-recipe' : kind === 'beer' ? '/add-beer' : '/add-wine', params: add.place.barId ? { barId: add.place.barId } : {} })}
        onImport={() => go('/bring-in' as Href)}
        onDrafts={() => go('/drafts' as Href)}
      />
      {/* Add-entry: the last row, titled, opens New. */}
      <PressableScale role="button" accessibilityLabel="Something else: a bottle, beer, wine, a house-made or a menu" onPress={onMore} style={styles.more}>
        <View style={[styles.plus, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="plus" size={18} color={ds.c.ink} />
        </View>
        <View style={styles.flex}>
          <Body style={{ ...font.semiBold }}>Something else</Body>
          <Caption tone="muted">A bottle, beer, wine, a house-made or a menu</Caption>
        </View>
        <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: { maxWidth: 520 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  title: { flex: 1, textAlign: 'center', ...type.body, ...font.semiBold },
  side: { width: layout.minTapTarget },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm },
  stack: { gap: space.md },
  field: { minHeight: 92, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm + 2, paddingTop: space.lg, paddingRight: space.sm + 2, paddingBottom: space.sm + 2, paddingLeft: space.lg },
  input: { flex: 1, minHeight: 64, paddingTop: 0, ...type.body, ...font.regular, textAlignVertical: 'top' },
  tools: { justifyContent: 'space-between', alignItems: 'flex-end', alignSelf: 'stretch', gap: space.xs },
  round: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  clip: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.control + 4, paddingVertical: space.md, paddingHorizontal: space.lg },
  buttons: { gap: space.sm + 2, marginTop: space.xs },
  flex: { flex: 1 },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm },
  plus: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
