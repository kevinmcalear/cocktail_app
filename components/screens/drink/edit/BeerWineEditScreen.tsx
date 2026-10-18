import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPickerModal, type CategoryPickerHandle } from '@/components/CategoryPickerModal';
import { Button, Caption, Chip, Field, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { GenerateImageButton } from '@/components/GenerateImageButton';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { displayFaces, fontFamilies, radius, space, type } from '@/constants/tokens';
import { useBeerWineDraftEditor } from '@/hooks/useBeerWineDraftEditor';
import { useBeerWineEditor, type BeerWineFields } from '@/hooks/useBeerWineEditor';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useHoldUpdates } from '@/hooks/useOtaUpdates';
import { savedSketch } from '@/lib/beerWineWizard';
import { confirmAsync } from '@/lib/dialogs';
import { bareItemId, DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { capitalize } from '@/lib/stringUtils';

import { DrinkHero } from '../DrinkHero';
import { EditBrand } from './DrinkEditScreen';
import { AccessSheet, EditBottomBar, EditMoreMenu, GrowingField, PhotosSheet, type MoreChoice } from './EditParts';
import { EditToolbar } from './EditToolbar';
import { useSnapshotHistory } from './useEditHistory';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
const PHONE_HERO = 300;

/**
 * /beer/<id>/edit and /wine/<id>/edit: its page in editing. Done or leaving
 * goes back to where Edit was pressed (as /cocktail/<id>/edit).
 */
export function BeerWineEditRoute({ kind }: { kind: DrinkKind }) {
  const router = useRouter();
  const id = bareItemId(kind, useLocalSearchParams<{ id?: string }>().id);
  const exit = () => (router.canGoBack() ? router.back() : router.replace(`/${kind}/${id}`));
  return <BeerWineEditScreen kind={kind} id={id} onExit={exit} />;
}

/** Editing a saved beer or wine in place, on the drink edit page (drink-edit-phone, drink-edit-desktop). Done saves. */
export function BeerWineEditScreen({ kind, id, onExit }: { kind: DrinkKind; id: string; onExit: () => void }) {
  const editor = useBeerWineEditor(kind, id);
  return (
    <EditBrand barId={editor.barId}>
      <BeerWineEditPage editor={editor} onExit={onExit} />
    </EditBrand>
  );
}

/** A beer or wine draft saved by the older editor (New > Drafts): Done keeps it a draft, More > Publish makes it one. */
export function BeerWineDraftEditScreen(props: { kind: DrinkKind; draftId: string; barId?: string | null; initialName?: string | null; onExit: () => void }) {
  const editor = useBeerWineDraftEditor(props);
  return (
    <EditBrand barId={editor.barId}>
      <BeerWineEditPage editor={editor} onExit={props.onExit} />
    </EditBrand>
  );
}

type Editor = ReturnType<typeof useBeerWineEditor> | ReturnType<typeof useBeerWineDraftEditor>;
/** What undo puts back: the words and tags (not photos or who can see it). */
type Words = Pick<BeerWineFields, 'name' | 'maker' | 'abv' | 'price' | 'description' | 'selectedCategories'>;

/**
 * The drink edit page for a beer or wine: its hero with Add a photo, the
 * Editing toolbar (undo, redo, Done), and its fields where its page shows
 * them (name, style and region, maker, strength, price, description). No
 * spec, so no Line or Calculator; More has photos, who can see it, discard,
 * and for a draft, Publish and Delete.
 */
function BeerWineEditPage({ editor, onExit }: { editor: Editor; onExit: () => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const top = Platform.OS === 'ios' ? space.sm : insets.top;
  const kind = DRINK_KINDS[editor.kind];
  const draft = 'draftId' in editor ? editor : null;
  const { data: dropdowns } = useDropdowns();
  const picker = useRef<CategoryPickerHandle>(null);
  const [sheet, setSheet] = useState<MoreChoice | 'more' | null>(null);
  useHoldUpdates();
  const words: Words = { name: editor.name, maker: editor.maker, abv: editor.abv, price: editor.price, description: editor.description, selectedCategories: editor.selectedCategories };
  const history = useSnapshotHistory<Words>(editor.ready ? words : null, editor.set);

  const done = async () => {
    if (!editor.isDirty) return onExit();
    if (draft ? await draft.handleSaveDraft() : 'handleSave' in editor && (await editor.handleSave())) onExit();
  };
  const leave = async () => {
    if (editor.isDirty && !(await confirmAsync({ title: 'Discard your changes?', message: 'Nothing you changed here is saved yet.', confirmText: 'Discard', destructive: true }))) return;
    onExit();
  };
  const onMore = async (c: MoreChoice) => {
    if (c === 'discard') return void leave();
    if (c === 'publish' && draft) return void ((await draft.handlePublish()) && onExit());
    if (c === 'delete' && draft) return void ((await draft.handleDelete()) && onExit());
    setSheet(c);
  };

  // The web: ⌘↵ is Done, ⌘Z and ⇧⌘Z undo and redo outside a text field, Escape leaves (as the drink editor).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 'Enter') return void (e.preventDefault(), done());
      if (cmd && !typing && e.key.toLowerCase() === 'z') return void (e.preventDefault(), e.shiftKey ? history.redo() : history.undo());
      if (e.key === 'Escape' && !typing && !sheet) void leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (editor.isLoading) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: ds.c.ground }]}>
        <ActivityIndicator color={ds.c.muted} />
      </View>
    );
  }

  const pictures = editor.localImages.map((img) => ({ url: img.url, isSketch: false, isOutdated: false }));
  const tags = editor.selectedCategories.map((id) => ({ id, name: dropdowns?.categories?.find((c) => c.id === id)?.name })).filter((t): t is { id: string; name: string } => !!t.name);
  const hero = (height: number) => (
    <View>
      <DrinkHero name={editor.name || kind.label} pictures={pictures} glass={null} sketch={savedSketch(editor.kind, tags.map((t) => t.name), null)} height={height} fade={!wide} />
      <View style={styles.photoButton}>
        <GlassButton accessibilityLabel="Add a photo" icon="camera" label={pictures.length ? 'Photos' : 'Add a photo'} onMedia onPress={() => (pictures.length ? setSheet('photos') : void editor.pickImage())} />
      </View>
    </View>
  );
  const body = (
    <>
      <TextInput
        value={editor.name}
        onChangeText={editor.setName}
        onBlur={() => editor.setName(capitalize(editor.name))}
        placeholder="Name"
        placeholderTextColor={ds.c.muted}
        accessibilityLabel={`${kind.label} name`}
        style={[styles.name, NO_OUTLINE, { color: ds.c.ink, borderBottomColor: ds.c.lineStrong, fontFamily: displayFaces[ds.displayFace].regular }]}
      />
      <View style={styles.section}>
        <Headline role="heading">Style and region</Headline>
        <View style={styles.chips}>
          {tags.map((t) => (
            <Chip key={t.id} label={t.name} selected multi accessibilityLabel={`${t.name}, tap to take it off`} onPress={() => editor.toggleCategory(t.id)} />
          ))}
          <Button label={tags.length ? 'Change' : 'Add style or region'} icon="plus" variant="secondary" size="sm" onPress={() => picker.current?.present()} />
        </View>
      </View>
      <Field label={kind.maker.label} placeholder={kind.maker.placeholder} value={editor.maker} onChangeText={editor.setMaker} onBlur={() => editor.setMaker(capitalize(editor.maker))} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="ABV (%)" placeholder={kind.placeholders.abv} value={editor.abv} onChangeText={editor.setAbv} keyboardType="decimal-pad" />
        </View>
        <View style={styles.flex}>
          <Field label="Price ($)" placeholder={kind.placeholders.price} value={editor.price} onChangeText={editor.setPrice} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={styles.section}>
        <Headline role="heading">Description</Headline>
        <GrowingField minHeight={96} value={editor.description} onChangeText={editor.setDescription} placeholder="What a guest would want to know" placeholderTextColor={ds.c.muted} accessibilityLabel="Description" style={[styles.box, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.surface }]} />
      </View>
      {draft ? <Caption tone="muted">A draft: Done keeps it here, More publishes it.</Caption> : null}
    </>
  );
  const toolbar = <EditToolbar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} onDone={() => void done()} saving={editor.saving} wide={wide} media={pictures.length ? 'photo' : 'paper'} more={wide ? <GlassButton accessibilityLabel="More" icon="ellipsis" onPress={() => setSheet('more')} /> : undefined} />;
  const noun = editor.kind;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.wide, { paddingTop: insets.top + space.xl }]}>
          <View style={styles.left}>
            <View style={styles.card}>{hero(440)}</View>
          </View>
          <View style={styles.right}>
            {toolbar}
            {body}
            <Button label="Discard changes and leave" variant="ghost" onPress={() => void leave()} />
          </View>
        </FormScrollContainer>
      ) : (
        <>
          <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
            {hero(PHONE_HERO + top)}
            <View style={[styles.phoneBody, { paddingHorizontal: gutter }]}>{body}</View>
          </FormScrollContainer>
          <View style={[styles.top, { top: top + space.sm, left: gutter, right: gutter }]}>{toolbar}</View>
          <View style={[styles.bottom, { bottom: insets.bottom + space.md, left: gutter, right: gutter }]}>
            <EditBottomBar onPhoto={() => void editor.pickImage()} onMore={() => setSheet('more')} moreHint={`More: photos, who can see this ${noun}, discard${draft ? ', publish, delete' : ''}`} />
          </View>
        </>
      )}
      <EditMoreMenu open={sheet === 'more'} onClose={() => setSheet(null)} canDelete={!!draft} dirty={editor.isDirty} draft={!!draft} noun={noun} onPick={(c) => void onMore(c)} />
      {sheet === 'photos' ? <PhotosSheet editor={editor} onClose={() => setSheet(null)} generate={'handleSave' in editor ? <GenerateImageButton type={editor.kind} id={editor.id} /> : undefined} /> : null}
      {sheet === 'access' ? <AccessSheet editor={editor} noun={noun} onClose={() => setSheet(null)} /> : null}
      <CategoryPickerModal ref={picker} domains={[editor.kind]} selectedCategoryIds={editor.selectedCategories} onToggleCategory={(cat) => editor.toggleCategory(cat.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  photoButton: { position: 'absolute', right: space.lg, bottom: space.xl },
  phoneBody: { gap: space.xl, marginTop: -space.lg },
  name: { ...type.display, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.xs },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  box: { ...type.body, fontFamily: fontFamilies.body, borderRadius: radius.control, padding: space.md, textAlignVertical: 'top' },
  top: { position: 'absolute' },
  bottom: { position: 'absolute' },
  wide: { flexDirection: 'row', gap: space.xxl, paddingHorizontal: space.xxl, paddingBottom: space.xxxl, alignItems: 'flex-start' },
  left: { width: 400, gap: space.lg },
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  right: { flex: 1, maxWidth: 680, gap: space.xl },
});
