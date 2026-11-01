import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DsText, GlassButton, PressableScale, Sheet, sheetIsDialog, SheetScrollView, dragDismissesKeyboard, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, type } from '@/constants/tokens';
import { addIntent, clipLine } from '@/lib/addIntent';
import { UNREAD_CLIP } from '@/lib/clipboardPeek';
import { isLink } from '@/lib/bringIn';
import { withAlpha } from '@/lib/color';

import { NewDrafts } from './NewDrafts';
import { useAddActions, useClipboardOffer } from './useAddActions';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Add (Prod-add-B, Kevin's pick 31 Oct 2026): one field first (a name, a
 * link or a description), what you just copied as one tap, then Snap and
 * Choose a photo or PDF, then what you left unfinished. A name opens a draft
 * in pencil; everything else is read by Bring in. `onMore` opens the
 * rest of what can be started (a bottle, beer, wine, a house-made, a menu).
 */
export function AddSheet({ visible, onClose, onMore }: { visible: boolean; onClose: () => void; onMore: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Add" keyboard style={sheetIsDialog ? styles.dialog : undefined} header={<Header />}>
      <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: sheetIsDialog ? space.lg : insets.bottom + space.lg }]} {...dragDismissesKeyboard}>
        {visible ? <AddBody onClose={onClose} onMore={onMore} /> : null}
      </SheetScrollView>
    </Sheet>
  );
}

function Header() {
  const close = useSheetClose();
  return (
    <View style={styles.header}>
      <GlassButton icon="xmark" accessibilityLabel="Close" onPress={close} />
      <DsText role="heading" style={styles.title}>
        Add
      </DsText>
      <View style={styles.side} />
    </View>
  );
}

function AddBody({ onClose, onMore }: { onClose: () => void; onMore: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const add = useAddActions(onClose);
  const clip = useClipboardOffer();
  const [text, setText] = useState('');
  const intent = addIntent(text);
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
        {intent ? (
          <PressableScale role="button" accessibilityLabel={intent === 'name' ? `Start a drink called ${text.trim()}` : 'Read it'} onPress={() => add.submit(text)} style={[styles.go, { backgroundColor: ds.accentFill.fill }]}>
            <IconSymbol name="arrow.up" size={18} color={ds.accentFill.text} />
          </PressableScale>
        ) : null}
      </View>
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
        onImport={() => go('/bring-in' as Href)}
        onDrafts={() => go('/drafts' as Href)}
      />
      <PressableScale role="button" accessibilityLabel="Something else: a bottle, beer, wine, a house-made or a menu" onPress={onMore} style={styles.more}>
        <Caption tone="muted" style={styles.flex}>
          A bottle, beer, wine, a house-made or a menu
        </Caption>
        <IconSymbol name="chevron.right" size={14} color={withAlpha(ds.c.muted, 0.8)} />
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
  field: { minHeight: 92, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-start', padding: space.sm, paddingLeft: space.lg },
  input: { flex: 1, minHeight: 72, paddingTop: space.sm, ...type.body, ...font.regular, textAlignVertical: 'top' },
  go: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  clip: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.control + 4, paddingVertical: space.md, paddingHorizontal: space.lg },
  buttons: { gap: space.sm + 2, marginTop: space.xs },
  flex: { flex: 1 },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget },
});
