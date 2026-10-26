import { useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { BarAssignmentAccordion } from '@/components/BarAssignmentAccordion';
import { SortableImageList, type ImageItem } from '@/components/cocktail/SortableImageList';
import { Caption, DsText, GlassSurface, Headline, MULTILINE_MAX, PressableScale, Sheet, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { layout, radius, space } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';
import type { useCocktailDraftEditor } from '@/hooks/useCocktailDraftEditor';
import type { useCocktailEditor } from '@/hooks/useCocktailEditor';

/** What editing in place drives: a saved drink's editor, or a draft's (which saves to drafts until it's published). */
export type DrinkEditor = ReturnType<typeof useCocktailEditor> | ReturnType<typeof useCocktailDraftEditor>;
type Editor = DrinkEditor;

type Level = string | null;
/** What the photos sheet edits: any editor's photos (a drink's, or a beer's or wine's). */
interface PhotosEditor {
  localImages: ImageItem[];
  setLocalImages: (images: ImageItem[]) => void;
  pickImage: () => void;
  addImages: (uris: string[]) => void;
}
/** What the access sheet edits: the venue it belongs to and its visibility levels. */
interface AccessEditor {
  barId: string | null;
  setBarId: (v: string | null) => void;
  overrideVisibility: Level;
  setOverrideVisibility: (v: Level) => void;
  overrideGeneric: Level;
  setOverrideGeneric: (v: Level) => void;
  overrideSpecific: Level;
  setOverrideSpecific: (v: Level) => void;
  overrideMeasurement: Level;
  setOverrideMeasurement: (v: Level) => void;
  overridePrep: Level;
  setOverridePrep: (v: Level) => void;
}

const SHEET_PAD = { paddingHorizontal: space.xl, paddingBottom: space.xxl };

/** One of the bottom bar's tools: an icon over its word. */
function Tool({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={hint} onPress={onPress} style={styles.tool}>
      <IconSymbol name={icon} size={22} color={ds.c.ink} />
      <DsText variant="caption" numberOfLines={1}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/**
 * The tools along the bottom while editing on a phone (drink-edit-phone): a line, a photo, the calculator, More.
 * A beer or wine has no spec, so no Line or Calculator. A house prep has Line, Step, Calculator and More;
 * a bottle Photo, Spot and More (ingredient-edit-proposal).
 */
export function EditBottomBar({ onLine, lineHint = 'Add a line to the spec', onStep, onPhoto, onSpot, onCalc, onMore, moreHint = 'More: photos, who can see the spec, discard, delete' }: { onLine?: () => void; lineHint?: string; onStep?: () => void; onPhoto?: () => void; onSpot?: () => void; onCalc?: () => void; onMore: () => void; moreHint?: string }) {
  return (
    <GlassSurface style={styles.bar}>
      <View role="toolbar" accessibilityLabel="Edit tools" style={styles.barRow}>
        {onLine ? <Tool icon="plus" label="Line" hint={lineHint} onPress={onLine} /> : null}
        {onStep ? <Tool icon="list.number" label="Step" hint="Add a step to the method" onPress={onStep} /> : null}
        {onPhoto ? <Tool icon="camera" label="Photo" hint="Add a photo" onPress={onPhoto} /> : null}
        {onSpot ? <Tool icon="map.fill" label="Spot" hint="Give it a spot on the back bar" onPress={onSpot} /> : null}
        {onCalc ? <Tool icon="percent" label="Calculator" hint="Ingredient calculator: amounts for a syrup, foam, juice or soda" onPress={onCalc} /> : null}
        <Tool icon="ellipsis" label="More" hint={moreHint} onPress={onMore} />
      </View>
    </GlassSurface>
  );
}

export type MoreChoice = 'publish' | 'photos' | 'access' | 'discard' | 'delete';

/** Editing's More: photos in order, who can see the spec, discard the changes, delete the drink. A draft can also be published. */
export function EditMoreMenu({ open, onClose, canDelete, dirty, draft, onPick, noun = 'drink', photosLabel = 'Photos' }: { open: boolean; onClose: () => void; canDelete: boolean; dirty: boolean; draft?: boolean; onPick: (c: MoreChoice) => void; /** What's edited: "drink", "beer", "wine" or "ingredient". */ noun?: string; /** An ingredient has one picture: "Its picture". */ photosLabel?: string }) {
  // What to open once the menu has gone: two sheets never stack.
  const then = useRef<MoreChoice | null>(null);
  const run = () => {
    const next = then.current;
    then.current = null;
    if (next) onPick(next);
  };
  return (
    <Sheet style={SHEET_PAD}
      visible={open}
      onClose={() => {
        onClose();
        if (Platform.OS !== 'ios') run();
      }}
      onDismiss={run}
      accessibilityLabel="More"
      header={<Headline role="heading">More</Headline>}
    >
      {draft ? <MoreRow icon="paperplane.fill" label={`Publish ${noun}`} onPick={() => (then.current = 'publish')} /> : null}
      <MoreRow icon="photo" label={photosLabel} onPick={() => (then.current = 'photos')} />
      <MoreRow icon="lock.shield.fill" label={accessTitle(noun)} onPick={() => (then.current = 'access')} />
      {dirty ? <MoreRow icon="arrow.uturn.backward" label="Discard changes" onPick={() => (then.current = 'discard')} /> : null}
      {canDelete ? <MoreRow icon="trash" label={draft ? 'Delete draft' : `Delete ${noun}`} danger onPick={() => (then.current = 'delete')} /> : null}
    </Sheet>
  );
}

function MoreRow({ icon, label, danger, onPick }: { icon: IconName; label: string; danger?: boolean; onPick: () => void }) {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <PressableScale
      role="button"
      accessibilityLabel={label}
      onPress={() => {
        onPick();
        close();
      }}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <IconSymbol name={icon} size={20} color={danger ? readableAccent(STATUS.danger, ds.c.ground) : ds.c.ink} />
      <DsText variant="body" color={danger ? readableAccent(STATUS.danger, ds.c.ground) : undefined} style={styles.flex}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/**
 * The drink's photos in order, from More (the hero shows the first).
 * ponytail: SortableImageList's row of tiles inside a ds Sheet; redraw it when photos get their own board.
 */
export function PhotosSheet({ editor, onClose, generate }: { editor: PhotosEditor; onClose: () => void; /** A tile that draws one (a beer or wine's Generate). */ generate?: ReactNode }) {
  return (
    <Sheet style={SHEET_PAD} visible onClose={onClose} accessibilityLabel="Photos" header={<Headline role="heading">Photos</Headline>}>
      <SortableImageList
        images={editor.localImages}
        onReorder={editor.setLocalImages}
        onRemove={(index) => editor.setLocalImages(editor.localImages.filter((_, i) => i !== index))}
        onAdd={editor.pickImage}
        onAddUris={editor.addImages}
        generateComponent={generate}
      />
      <Caption tone="muted">The first one leads the page. Saved with Done.</Caption>
    </Sheet>
  );
}

/**
 * Who can see the spec: the venue it belongs to and its visibility levels (the old editor's Advanced).
 * ponytail: the legacy BarAssignmentAccordion inside a ds Sheet; move it onto ds controls when the role lens board covers it.
 */
export function AccessSheet({ editor, onClose, noun = 'drink' }: { editor: AccessEditor; onClose: () => void; noun?: string }) {
  return (
    <Sheet style={SHEET_PAD} visible onClose={onClose} accessibilityLabel={accessTitle(noun)} header={<Headline role="heading">{accessTitle(noun)}</Headline>}>
      <ScrollView style={styles.access}>
        <BarAssignmentAccordion
          barId={editor.barId}
          setBarId={editor.setBarId}
          overrideVisibility={editor.overrideVisibility}
          setOverrideVisibility={editor.setOverrideVisibility}
          overrideGeneric={editor.overrideGeneric}
          setOverrideGeneric={editor.setOverrideGeneric}
          overrideSpecific={editor.overrideSpecific}
          setOverrideSpecific={editor.setOverrideSpecific}
          overrideMeasurement={editor.overrideMeasurement}
          setOverrideMeasurement={editor.setOverrideMeasurement}
          overridePrep={editor.overridePrep}
          setOverridePrep={editor.setOverridePrep}
        />
      </ScrollView>
    </Sheet>
  );
}

/** A drink keeps its spec back; a beer or wine has none, so it's the page itself. */
const accessTitle = (noun: string) => (noun === 'drink' ? 'Who can see the spec' : `Who can see this ${noun}`);

const styles = StyleSheet.create({
  bar: { borderRadius: radius.pill, padding: space.xs },
  barRow: { flexDirection: 'row' },
  tool: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  access: { maxHeight: 480 },
});

/**
 * A multiline field that grows with its words up to about six lines, then
 * scrolls inside, so the page under it stays in reach on a phone. A native box
 * sizes to its words on its own; the web's textarea needs `field-sizing`.
 * Its height isn't set from onContentSizeChange: on iOS that height fed back
 * into the content size, and the boxes kept resizing as the page scrolled.
 */
export function GrowingField({ minHeight, ...props }: TextInputProps & { minHeight: number }) {
  const [full, setFull] = useState(false);
  return (
    <TextInput
      multiline
      // Off until it's full, so a swipe over a short box scrolls the page.
      scrollEnabled={full}
      {...props}
      onLayout={(e) => {
        setFull(e.nativeEvent.layout.height >= MULTILINE_MAX - 1);
        props.onLayout?.(e);
      }}
      style={[props.style, { minHeight, maxHeight: MULTILINE_MAX }, FIT_WORDS]}
    />
  );
}

// ponytail: browsers without field-sizing (Firefox) keep the box at minHeight and scroll inside it.
const FIT_WORDS = Platform.OS === 'web' ? ({ fieldSizing: 'content' } as object) : null;
