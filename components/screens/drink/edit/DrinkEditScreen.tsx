import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, Button, Caption, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { displayFaces, fontFamilies, radius, space, type } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { creditedToBar, useCocktail } from '@/hooks/useCocktails';
import { useCocktailEditor } from '@/hooks/useCocktailEditor';
import { useHoldUpdates } from '@/hooks/useOtaUpdates';
import { confirmAsync } from '@/lib/dialogs';
import { applyIngredientHandoff } from '@/lib/ingredientHandoff';
import type { ItemImageLink } from '@/lib/itemImages';
import { capitalize } from '@/lib/stringUtils';
import { useAppStore } from '@/store/useAppStore';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { DrinkHero } from '../DrinkHero';
import { SketchColourSheet } from '../SketchColour';
import { useDeleteDrink } from '../useDeleteDrink';
import { ShotList } from '../ShotList';
import { AccessSheet, EditBottomBar, EditMoreMenu, GrowingField, PhotosSheet, type DrinkEditor, type MoreChoice } from './EditParts';
import { EditSpecList } from './EditSpecList';
import { EditToolbar } from './EditToolbar';
import { IngredientPickSheet } from './IngredientPickSheet';
import { MadeList } from './MadeList';
import { SpecPad } from './SpecPad';
import { useEditHistory } from './useEditHistory';
import { VenueSections, type PendingEdits, type VenueSheet } from './VenueSections';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
const PHONE_HERO = 300;

/**
 * Editing a drink in place (drink-edit-phone, drink-edit-desktop): the drink
 * page itself, with every part editable where it reads. Glass toolbar with
 * undo, redo and Done (which saves); spec lines with a grip and a spec pad;
 * how it's made in small sheets; photos, story and team notes. Replaces the
 * old editor form (decided 15 Oct 2026). Drafts open the same page (DraftEditScreen).
 */
export function DrinkEditScreen({ id, onExit }: { id: string; onExit: () => void }) {
  return (
    <EditBrand barId={useCocktail(id).data?.bar_id}>
      <SavedDrinkEdit id={id} onExit={onExit} />
    </EditBrand>
  );
}

/** Editing's theme, in the colours of the venue the drink belongs to. */
export function EditBrand({ barId, children }: { barId: string | null | undefined; children: ReactNode }) {
  const { venues } = useActiveVenue();
  const venue = venues.find((v) => v.id === barId);
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined} displayFace={venue?.displayFace}>
        {children}
      </BrandProvider>
    </BackbarTheme>
  );
}

function SavedDrinkEdit({ id, onExit }: { id: string; onExit: () => void }) {
  return <EditPage editor={useCocktailEditor(id)} id={id} onExit={onExit} />;
}

/** The page for a saved drink (`id`) or a draft (`id` null): a draft's Done keeps it a draft, and More publishes it. */
export function EditPage({ editor, id, onExit }: { editor: DrinkEditor; id: string | null; onExit: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  // The drink page opens as a page sheet on iOS, which starts below the status bar (as DrinkScreen).
  const top = Platform.OS === 'ios' ? space.sm : insets.top;
  const cocktail = useCocktail(id ?? undefined).data;
  const draft = 'draftId' in editor ? editor : null;
  const history = useEditHistory(editor);
  useHoldUpdates();
  const deleteDrink = useDeleteDrink();
  const credited = !!cocktail && creditedToBar(cocktail);
  // Who a new ingredient made from here comes back to: this drink, or this draft.
  const selfId = id ?? draft?.draftId ?? null;

  const [pad, setPad] = useState<number | null>(null);
  const [picking, setPicking] = useState<{ swap: number | null } | null>(null);
  const [sheet, setSheet] = useState<MoreChoice | VenueSheet | 'calc' | 'more' | 'colour' | null>(null);
  // For the floor, Service and Price: saved with Done, next to the editor's own changes.
  const venueEdits = useRef<PendingEdits | null>(null);
  const [venueDirty, setVenueDirty] = useState(false);

  // A new ingredient made from here comes back onto this drink's spec.
  const { recentlyCreatedItem, setRecentlyCreatedItem } = useAppStore();
  useEffect(() => {
    if (recentlyCreatedItem?.type !== 'ingredient' || !selfId || recentlyCreatedItem.targetId !== selfId) return;
    const handoff = recentlyCreatedItem;
    editor.setRecipeItems((prev) => applyIngredientHandoff(prev, handoff, selfId, { amount: '', unit: getPreferredUnit(), preparation_notes: '', is_optional: false }) ?? prev);
    setRecentlyCreatedItem(null);
  }, [editor, recentlyCreatedItem, setRecentlyCreatedItem, selfId]);

  const done = async () => {
    if (venueEdits.current?.dirty && !(await venueEdits.current.save())) return;
    if (!editor.isDirty) return onExit();
    if (draft ? await draft.handleSaveDraft(false) : await editor.handleSave()) onExit();
  };
  const leave = async () => {
    if ((editor.isDirty || venueEdits.current?.dirty) && !(await confirmAsync({ title: 'Discard your changes?', message: 'Nothing you changed here is saved yet.', confirmText: 'Discard', destructive: true }))) return;
    editor.discardChanges();
    onExit();
  };
  const remove = async () => {
    if (draft) return void ((await draft.handleDelete()) && onExit());
    if (!cocktail) return;
    // No question first: the toast's Undo brings it back (useDeleteDrink).
    deleteDrink({ id: cocktail.id, name: cocktail.name });
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  const publish = async () => void (draft && (await draft.handlePublish()) && onExit());
  const onMore = (c: MoreChoice) => (c === 'discard' ? void leave() : c === 'delete' ? void remove() : c === 'publish' ? void publish() : setSheet(c));

  // The web: ⌘↵ is Done, ⌘Z and ⇧⌘Z undo and redo outside a text field, Escape leaves.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 'Enter') return void (e.preventDefault(), done());
      if (cmd && !typing && e.key.toLowerCase() === 'z') return void (e.preventDefault(), e.shiftKey ? history.redo() : history.undo());
      if (e.key === 'Escape' && !typing && pad === null && !picking && !sheet) void leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lines = editor.recipeItems;
  const setLine = (i: number, updates: Partial<(typeof lines)[number]>) => editor.setRecipeItems((prev) => prev.map((l, j) => (j === i ? { ...l, ...updates } : l)));
  const pictures = editor.localImages.map((img) => ({ url: img.url, isSketch: false, isOutdated: false }));

  const hero = (height: number) => (
    <View>
      <DrinkHero name={editor.name || cocktail?.name || ''} pictures={pictures} glass={null} itemId={id} height={height} fade={!wide} onColour={() => setSheet('colour')} />
      {/* Level with Colour on the drawing (DrinkHero's buttons sit clear of the fade). */}
      <View style={[styles.photoButton, { bottom: wide ? space.lg : space.xxl + space.md }]}>
        <GlassButton accessibilityLabel="Add a photo" icon="camera" label={pictures.length ? 'Photos' : 'Add a photo'} onMedia onPress={() => (pictures.length ? setSheet('photos') : void editor.pickImage())} />
      </View>
    </View>
  );
  const fieldBox = [styles.box, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.surface }];
  const words = (
    <>
      <TextInput
        value={editor.name}
        onChangeText={editor.setName}
        onBlur={() => editor.setName(capitalize(editor.name))}
        placeholder="Name"
        placeholderTextColor={ds.c.muted}
        accessibilityLabel="Drink name"
        style={[styles.name, NO_OUTLINE, { color: ds.c.ink, borderBottomColor: ds.c.lineStrong, fontFamily: displayFaces[ds.displayFace].regular }]}
      />
      <TextInput value={editor.origin} onChangeText={editor.setOrigin} placeholder="Where it’s from: a bar, a year" placeholderTextColor={ds.c.muted} accessibilityLabel="Origin" style={[styles.origin, NO_OUTLINE, { color: ds.c.muted }]} />
    </>
  );
  const servicePhotos = cocktail && id ? <ShotList itemId={id} barId={cocktail.bar_id ?? null} links={cocktail.item_images as ItemImageLink[] | undefined} /> : null;
  const body = (
    <>
      <EditSpecList
        items={lines}
        onReorder={editor.setRecipeItems}
        onRemove={(i) => editor.setRecipeItems((prev) => prev.filter((_, j) => j !== i))}
        onAmount={setPad}
        onSwap={(i) => setPicking({ swap: i })}
        onAdd={() => setPicking({ swap: null })}
      />
      <MadeList editor={editor} itemId={id} />
      <View style={styles.section}>
        <Headline role="heading">Story</Headline>
        <GrowingField minHeight={96} value={editor.description} onChangeText={editor.setDescription} placeholder="Where it comes from, what it tastes like" placeholderTextColor={ds.c.muted} accessibilityLabel="Story" style={fieldBox} />
      </View>
      <View style={styles.section}>
        <View style={styles.headRow}>
          <Headline role="heading">Notes for the team</Headline>
          <Caption tone="muted">Staff only</Caption>
        </View>
        <GrowingField minHeight={96} value={editor.notes} onChangeText={editor.setNotes} placeholder="Tricks, swaps, what guests ask" placeholderTextColor={ds.c.muted} accessibilityLabel="Notes for the team" style={fieldBox} />
      </View>
      {cocktail && id ? <VenueSections item={cocktail} onPending={(p) => ((venueEdits.current = p), setVenueDirty(p.dirty))} sheet={sheet === 'classic' || sheet === 'publish' || sheet === 'glass' ? sheet : null} onSheet={setSheet} servicePhotos={wide ? undefined : servicePhotos} /> : null}
    </>
  );
  const toolbar = <EditToolbar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} changes={history.changes} onDone={() => void done()} saving={editor.saving} wide={wide} media={pictures.length ? 'photo' : 'paper'} more={wide ? <GlassButton accessibilityLabel="More" icon="ellipsis" onPress={() => setSheet('more')} /> : undefined} />;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.wide, { paddingTop: insets.top + space.xl }]}>
          <View style={styles.left}>
            <View style={styles.card}>{hero(440)}</View>
            {servicePhotos}
          </View>
          <View style={styles.right}>
            {toolbar}
            {words}
            {body}
            <Button label="Discard changes and leave" variant="ghost" onPress={() => void leave()} />
          </View>
        </FormScrollContainer>
      ) : (
        <>
          <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
            {hero(PHONE_HERO + top)}
            <View style={[styles.phoneBody, { paddingHorizontal: gutter }]}>
              {words}
              {body}
            </View>
          </FormScrollContainer>
          <View style={[styles.top, { top: top + space.sm, left: gutter, right: gutter }]}>{toolbar}</View>
          <View style={[styles.bottom, { bottom: insets.bottom + space.md, left: gutter, right: gutter }]}>
            <EditBottomBar onLine={() => setPicking({ swap: null })} onPhoto={() => void editor.pickImage()} onCalc={() => setSheet('calc')} onMore={() => setSheet('more')} />
          </View>
        </>
      )}

      {pad !== null && lines[pad] ? (
        <SpecPad
          key={pad}
          line={lines[pad]}
          index={pad}
          count={lines.length}
          nextName={lines[pad + 1]?.name ?? null}
          onChange={(u) => setLine(pad, u)}
          onNext={() => setPad(pad + 1 < lines.length ? pad + 1 : null)}
          onSwap={() => {
            setPicking({ swap: pad });
            setPad(null);
          }}
          onClose={() => setPad(null)}
        />
      ) : null}
      {picking ? (
        <IngredientPickSheet
          editor={editor}
          drink={editor.name || cocktail?.name || 'This drink'}
          swapping={picking.swap !== null && lines[picking.swap] ? { id: lines[picking.swap].ingredient_id || null, name: lines[picking.swap].name } : null}
          inSpec={lines.map((l) => l.ingredient_id).filter(Boolean)}
          onClose={() => setPicking(null)}
          onPick={(p) => {
            if (picking.swap !== null) setLine(picking.swap, { ingredient_id: p.id!, name: p.name });
            else editor.setRecipeItems((prev) => [...prev, { ingredient_id: p.id!, name: p.name, amount: '', unit: getPreferredUnit(), preparation_notes: '', is_optional: false }]);
            const at = picking.swap ?? lines.length;
            setPicking(null);
            // A new line goes straight to its amount.
            if (picking.swap === null) setPad(at);
          }}
          onNew={async (name, made) => {
            setPicking(null);
            // A draft saves first, so coming back doesn't lose its spec and the new ingredient knows where to go.
            const parent = draft ? await draft.persistDraft(true) : id;
            // Made in-house: the recipe steps; a bottle you buy, or just the name: the bottle form.
            router.push({ pathname: made ? '/make-recipe' : '/add-ingredient', params: { name, barId: editor.barId || '', attachTo: parent || '' } });
          }}
        />
      ) : null}
      <EditMoreMenu open={sheet === 'more'} onClose={() => setSheet(null)} canDelete={!credited} dirty={editor.isDirty || venueDirty} draft={!!draft} onPick={onMore} />
      {sheet === 'photos' ? <PhotosSheet editor={editor} onClose={() => setSheet(null)} /> : null}
      {sheet === 'access' ? <AccessSheet editor={editor} onClose={() => setSheet(null)} /> : null}
      {sheet === 'colour' && id ? <SketchColourSheet visible onClose={() => setSheet(null)} itemId={id} name={editor.name || cocktail?.name || ''} /> : null}
      {sheet === 'calc' ? <ToolsSheet visible onClose={() => setSheet(null)} tool="prep" prepName={editor.name} scheme={ds.scheme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  photoButton: { position: 'absolute', right: space.lg },
  phoneBody: { gap: space.xl, marginTop: -space.lg },
  name: { ...type.display, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.xs },
  origin: { ...type.body, fontFamily: fontFamilies.body, marginTop: -space.md },
  section: { gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  box: { ...type.body, fontFamily: fontFamilies.body, borderRadius: radius.control, padding: space.md, textAlignVertical: 'top' },
  top: { position: 'absolute' },
  bottom: { position: 'absolute' },
  wide: { flexDirection: 'row', gap: space.xxl, paddingHorizontal: space.xxl, paddingBottom: space.xxxl, alignItems: 'flex-start' },
  left: { width: 400, gap: space.lg },
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  right: { flex: 1, maxWidth: 680, gap: space.xl },
});
