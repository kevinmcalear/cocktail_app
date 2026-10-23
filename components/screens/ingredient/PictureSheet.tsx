import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, GlassButton, IngredientDrawing, PressableScale, Sheet, SheetScrollView, sheetIsDialog, TextLink, Title, useBreakpoint, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IngredientPhoto } from '@/components/ds/IngredientDrawing';
import { pickDrinkPhotos, takeDrinkPhoto } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';
import type { IngredientPicture } from '@/lib/ingredientPicture';

export type PictureChoice = { picture: IngredientPicture; photo: string | null };

const WHERE = 'Shows on its page, in specs, in the Library and on your back bar.';
const ART = 72;

/**
 * "Its picture" (eddie-oct22-ingredient-picture): Drawing, Your photo or None.
 * Phones stack the three and take or choose a photo; wide screens set them
 * side by side, with a drop zone for the photo, Cancel and a close button.
 * Done hands the choice back to the edit page, which saves it with Save.
 */
export function PictureSheet({ itemId, name, value, onDone, onClose }: { itemId: string; name: string; value: PictureChoice; onDone: (choice: PictureChoice) => void; onClose: () => void }) {
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  const [choice, setChoice] = useState(value);
  const [dropping, setDropping] = useState(false);
  const takeUri = (uri: string | null | undefined) => uri && setChoice({ picture: 'photo', photo: uri });
  const choose = async () => takeUri((await pickDrinkPhotos({ square: true }))[0]);
  const take = async () => takeUri(await takeDrinkPhoto({ square: true }));
  // Wide screens on the web: a photo dropped anywhere on its card.
  const dropRef = useWebImageDrop(wide ? (uris) => takeUri(uris[0]) : undefined, setDropping);
  const photo = choice.photo;
  const select = (picture: IngredientPicture) => (picture === 'photo' && !photo ? void choose() : setChoice({ ...choice, picture }));

  return (
    <Sheet visible onClose={onClose} accessibilityLabel={`Its picture, ${name}`} style={[styles.sheet, wide ? styles.wide : null]} header={<Head wide={wide} />}>
      <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {wide ? null : <Caption tone="muted">{WHERE}</Caption>}
        <View role="radiogroup" aria-label="Its picture" style={wide ? styles.grid : styles.list}>
          <Option wide={wide} selected={choice.picture === 'drawing'} title="Drawing" body={wide ? 'Drawn from what it is.' : 'Drawn from what it is. Changes if you change what it’s a kind of.'} onPress={() => select('drawing')} art={<Paper><IngredientDrawing id={itemId} name={name} drawn detail={wide ? 'full' : 'thumb'} /></Paper>} />
          <Option
            wide={wide}
            selected={choice.picture === 'photo'}
            title="Your photo"
            body={wide ? 'Your own bottle or batch, cropped square.' : 'A shot of your own bottle or batch, cropped square.'}
            onPress={() => select('photo')}
            dropRef={dropRef}
            art={
              photo ? (
                <Paper><IngredientPhoto url={photo} /></Paper>
              ) : wide ? (
                <View style={[styles.drop, { borderColor: ds.accentFill.fill, backgroundColor: dropping ? ds.c.line : 'transparent' }]}>
                  <Icon name="arrow.up" />
                  <Caption tone="muted" align="center">Drop a photo or choose one</Caption>
                </View>
              ) : (
                <View style={[styles.camera, { backgroundColor: ds.c.line }]}><Icon name="camera.fill" /></View>
              )
            }
          >
            {wide ? (
              photo ? <TextLink label="Choose another" onPress={() => void choose()} /> : null
            ) : (
              <View style={styles.buttons}>
                <Button label="Take a photo" variant="secondary" onPress={() => void take()} style={styles.flex} />
                <Button label="Choose a photo" variant="secondary" onPress={() => void choose()} style={styles.flex} />
              </View>
            )}
          </Option>
          <Option wide={wide} selected={choice.picture === 'none'} title="None" body={wide ? 'Just the name.' : 'Just the name. Nothing drawn, no photo.'} onPress={() => select('none')} art={<Dashed />} />
        </View>
        {wide ? <Caption tone="muted">{WHERE}</Caption> : null}
        <Actions wide={wide} onDone={() => onDone(choice)} />
      </SheetScrollView>
    </Sheet>
  );
}

function Head({ wide }: { wide: boolean }) {
  const close = useSheetClose();
  return (
    <View style={styles.head}>
      <Title style={styles.flex}>Its picture</Title>
      {wide ? <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} /> : null}
    </View>
  );
}

function Actions({ wide, onDone }: { wide: boolean; onDone: () => void }) {
  const close = useSheetClose();
  const done = () => {
    onDone();
    close();
  };
  if (!wide) return <Button label="Done" size="lg" onPress={done} />;
  return (
    <View style={styles.actions}>
      <Button label="Cancel" variant="secondary" onPress={close} />
      <Button label="Done" onPress={done} />
    </View>
  );
}

/** One choice: a row on a phone (picture, words, a tick), a card on a wide screen (picture over its words). */
function Option({ wide, selected, title, body, art, onPress, dropRef, children }: { wide: boolean; selected: boolean; title: string; body: string; art: ReactNode; onPress: () => void; dropRef?: Ref<ComponentRef<typeof View>>; children?: ReactNode }) {
  const ds = useDs();
  const ring = { borderColor: selected ? ds.accentFill.fill : ds.c.line, borderWidth: selected ? 2 : StyleSheet.hairlineWidth, backgroundColor: ds.c.raised };
  const words = (
    <View style={wide ? styles.wordsWide : styles.words}>
      <Body style={styles.bold}>{title}</Body>
      <Caption tone="muted">{body}</Caption>
    </View>
  );
  return (
    <View ref={dropRef} style={[styles.option, wide ? styles.card : null, ring]}>
      <PressableScale role="radio" aria-checked={selected} accessibilityLabel={`${title}. ${body}`} onPress={onPress} style={wide ? styles.cardPress : styles.row}>
        <View style={wide ? styles.artWide : styles.art}>{art}</View>
        {words}
        {!wide && selected ? (
          <View style={[styles.tick, { backgroundColor: ds.accentFill.fill }]}>
            <IconSymbol name="checkmark" size={14} color={ds.accentFill.text} />
          </View>
        ) : null}
      </PressableScale>
      {children}
    </View>
  );
}

function Paper({ children }: { children: ReactNode }) {
  return <View style={[styles.fill, { backgroundColor: useDs().c.paper }]}>{children}</View>;
}

function Dashed() {
  return <View aria-hidden style={[styles.fill, styles.dashed, { borderColor: useDs().c.lineStrong }]} />;
}

function Icon({ name }: { name: IconName }) {
  return <IconSymbol name={name} size={28} color={useDs().c.ink} />;
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  wide: { maxWidth: 720, padding: space.xl },
  scroll: { flexShrink: 1 },
  body: { gap: space.md, paddingBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: sheetIsDialog ? space.md : 0, paddingBottom: space.xs },
  list: { gap: space.md },
  grid: { flexDirection: 'row', gap: space.md, alignItems: 'stretch' },
  option: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.md },
  card: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardPress: { gap: space.sm },
  art: { width: ART, height: ART, borderRadius: radius.control, overflow: 'hidden' },
  artWide: { width: '100%', aspectRatio: 1, borderRadius: radius.control, overflow: 'hidden' },
  fill: { flex: 1, width: '100%', height: '100%', borderRadius: radius.control, overflow: 'hidden' },
  dashed: { borderWidth: 2, borderStyle: 'dashed' },
  camera: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  drop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.md, borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.control },
  words: { flex: 1, minWidth: 0, gap: 2 },
  wordsWide: { gap: 2 },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  tick: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
