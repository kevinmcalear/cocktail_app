import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, Button, Caption, GlassButton, Headline, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, layout, radius, space, type } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBackBarIds } from '@/hooks/useBackBar';
import { creditedToBar, useCocktail } from '@/hooks/useCocktails';
import { useCocktailEditor } from '@/hooks/useCocktailEditor';
import { useHoldUpdates } from '@/hooks/useOtaUpdates';
import { useLatestVersion } from '@/hooks/useVersions';
import type { ItemImageLink } from '@/lib/itemImages';
import { confirmAsync } from '@/lib/dialogs';
import { capitalize } from '@/lib/stringUtils';

import type { CatalogIngredient } from '../../addDrink/IngredientSearch';
import { Eyebrow } from '../../addDrink/WizardChrome';
import { ShotList } from '../ShotList';
import { SketchColourSheet } from '../SketchColour';
import { useDeleteDrink } from '../useDeleteDrink';
import { AccessSheet, EditMoreMenu, GrowingField, PhotosSheet, type DrinkEditor, type MoreChoice } from './EditParts';
import { DrinkSpec } from './DrinkSpec';
import { EditCredits } from './EditCredits';
import { EditStepNotes } from './EditStepNotes';
import { EditToolbar } from './EditToolbar';
import { FitGlassEdit, useDraftGlassFill } from './FitGlassEdit';
import { MadeList } from './MadeList';
import { PhonePreview, PREVIEW_ROOM } from './PhonePreview';
import { useEditHistory } from './useEditHistory';
import { VenueSections, type PendingEdits, type VenueSheet } from './VenueSections';

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Editing a drink in place, as Miss-steps, Miss-steps-cases and
 * Miss-steps-desk draw it: undo, redo and Done (which saves) at the top,
 * "Editing · saves as version 3" over the name, the spec lines, How it goes
 * out (method, glass, ice), the words on each step, and who made it. No
 * hero: photos and the drawing's colour are in More. On a desktop the
 * editor sits beside the drink as a phone shows it. Drafts open the same
 * page (DraftEditScreen).
 */
export function DrinkEditScreen({ id, onExit, openOn, inSheet }: { id: string; onExit: () => void; openOn?: OpenOn; inSheet?: boolean }) {
  return (
    <EditBrand barId={useCocktail(id).data?.bar_id}>
      <SavedDrinkEdit id={id} onExit={onExit} openOn={openOn} inSheet={inSheet} />
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

/** The sheet editing opens on: Fit it to the glass, or the photos (the drink page's Photos button). */
export type OpenOn = 'fit' | 'photos';

function SavedDrinkEdit({ id, onExit, openOn, inSheet }: { id: string; onExit: () => void; openOn?: OpenOn; inSheet?: boolean }) {
  return <EditPage editor={useCocktailEditor(id)} id={id} onExit={onExit} openOn={openOn} inSheet={inSheet} />;
}

/** The page for a saved drink (`id`) or a draft (`id` null): a draft's Done keeps it a draft, and More publishes it. `openOn` opens on one of its sheets. */
/** `inSheet`: on iOS this route is a modal sheet, which starts below the status bar. */
export function EditPage({ editor, id, onExit, openOn, inSheet }: { editor: DrinkEditor; id: string | null; onExit: () => void; openOn?: OpenOn; inSheet?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  // A wide desktop window: the finished drink on a phone, on the right (dec-23).
  const roomy = useWindowDimensions().width >= PREVIEW_ROOM;
  // The drink page opens as a page sheet on iOS, which starts below the status bar (as DrinkScreen).
  const top = inSheet && Platform.OS === 'ios' ? space.sm : insets.top;
  const cocktail = useCocktail(id ?? undefined).data;
  const fill = useDraftGlassFill(editor, cocktail);
  const draft = 'draftId' in editor ? editor : null;
  const history = useEditHistory(editor);
  useHoldUpdates();
  const deleteDrink = useDeleteDrink();
  const credited = !!cocktail && creditedToBar(cocktail);
  const { venues } = useActiveVenue();
  const venueName = venues.find((v) => v.id === editor.barId)?.name ?? null;
  const ingredients = (editor.allIngredients ?? []) as CatalogIngredient[];
  const backBar = useBackBarIds(editor.barId || null, ingredients);
  const latest = useLatestVersion(id && !draft ? id : null).data;
  // The page's eyebrow: what Done makes of it (Miss-steps "Editing · saves as version 3"; a draft or a first save "new drink").
  const saves = !id || draft ? 'Editing · new drink' : latest !== undefined ? `Editing · saves as version ${(latest?.version ?? 0) + 1}` : 'Editing';

  // Bumped by the Garnish row: the cursor goes to the spec's Add field.
  const [addLine, setAddLine] = useState(0);
  const [sheet, setSheet] = useState<MoreChoice | VenueSheet | 'calc' | 'more' | 'colour' | 'fit' | null>(openOn ?? null);
  // For the floor, Service and Price: saved with Done, next to the editor's own changes.
  const venueEdits = useRef<PendingEdits | null>(null);
  const [venueDirty, setVenueDirty] = useState(false);

  // Done and Save changes both save: one at a time, or a double tap uploads the photos twice.
  const saving = useRef(false);
  const done = async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      if (venueEdits.current?.dirty && !(await venueEdits.current.save())) return;
      if (!editor.isDirty) return onExit();
      if (draft ? await draft.handleSaveDraft(false) : await editor.handleSave()) onExit();
    } finally {
      saving.current = false;
    }
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
    else router.replace('/');
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
      if (e.key === 'Escape' && !typing && !sheet) void leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fieldBox = [styles.box, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.surface }];
  const words = (
    <View>
      <Eyebrow>{saves}</Eyebrow>
      <TextInput
        value={editor.name}
        onChangeText={editor.setName}
        onBlur={() => editor.setName(capitalize(editor.name))}
        placeholder="Name"
        placeholderTextColor={ds.c.muted}
        accessibilityLabel="Drink name"
        style={[styles.name, NO_OUTLINE, { color: ds.c.ink, fontFamily: displayFaces[ds.displayFace].regular }]}
      />
    </View>
  );
  const servicePhotos = cocktail && id ? <ShotList itemId={id} barId={cocktail.bar_id ?? null} links={cocktail.item_images as ItemImageLink[] | undefined} /> : null;
  const body = (
    <>
      <DrinkSpec
        editor={editor}
        name={editor.name || cocktail?.name || 'This drink'}
        ingredients={ingredients}
        aliases={editor.dropdowns?.ingredientAliases}
        coreIds={new Set(editor.dropdowns?.coreIngredientIds ?? [])}
        loading={!editor.dropdowns?.ingredients}
        bar={editor.barId ? { id: editor.barId, name: venueName ?? '' } : null}
        backBar={editor.barId ? backBar : undefined}
        focus={addLine}
      />
      {cocktail ? <FitGlassEdit editor={editor} item={cocktail} result={fill} open={sheet === 'fit'} onOpen={() => setSheet('fit')} onClose={() => setSheet(null)} /> : null}
      <MadeList editor={editor} itemId={id} onGarnish={() => setAddLine((n) => n + 1)} />
      {'setStepNote' in editor ? <EditStepNotes editor={editor} known={cocktail?.item_methods} /> : null}
      {id ? <EditCredits itemId={id} /> : null}
      {/* Not drawn on Miss-steps: the credit line under the name on the page, kept with who made it. */}
      <View style={styles.section}>
        <Headline role="heading">Where it’s from</Headline>
        <TextInput value={editor.origin} onChangeText={editor.setOrigin} placeholder="A bar, a year" placeholderTextColor={ds.c.muted} accessibilityLabel="Where it’s from" style={fieldBox} />
      </View>
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
      {cocktail && id ? <VenueSections item={cocktail} glassFill={fill} onPending={(p) => ((venueEdits.current = p), setVenueDirty(p.dirty))} sheet={sheet === 'classic' || sheet === 'publish' || sheet === 'glass' ? sheet : null} onSheet={setSheet} servicePhotos={servicePhotos} /> : null}
    </>
  );
  const name = editor.name || cocktail?.name || 'New drink';
  const crumb = [venueName ?? 'Home', 'Drinks', name, 'Editing'].join(' › ');
  const more = wide ? (
    <GlassButton accessibilityLabel="More" icon="ellipsis" onPress={() => setSheet('more')} />
  ) : (
    <PressableScale role="button" accessibilityLabel="More" onPress={() => setSheet('more')} style={[styles.round, { backgroundColor: ds.c.surface }]}>
      <IconSymbol name="ellipsis" size={20} color={ds.c.ink} />
    </PressableScale>
  );
  const toolbar = <EditToolbar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} changes={history.changes} onDone={() => void done()} saving={editor.saving} wide={wide} media="page" crumb={crumb} more={more} />;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.wide, { paddingTop: insets.top + space.xl }]}>
          <View style={styles.right}>
            {toolbar}
            {words}
            {body}
            <Button label="Discard changes and leave" variant="ghost" onPress={() => void leave()} />
          </View>
          {roomy && cocktail ? <PhonePreview editor={editor} saved={cocktail} /> : null}
        </FormScrollContainer>
      ) : (
        <>
          <View style={{ paddingTop: top + space.sm, paddingHorizontal: gutter, paddingBottom: space.sm }}>{toolbar}</View>
          <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.phoneBody, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }]}>
            {words}
            {body}
          </FormScrollContainer>
        </>
      )}

      <EditMoreMenu open={sheet === 'more'} onClose={() => setSheet(null)} canDelete={!credited} dirty={editor.isDirty || venueDirty} draft={!!draft} calc={!wide} colour={!!id} onPick={onMore} />
      {sheet === 'photos' ? <PhotosSheet editor={editor} onClose={() => setSheet(null)} /> : null}
      {sheet === 'access' ? <AccessSheet editor={editor} onClose={() => setSheet(null)} /> : null}
      {sheet === 'colour' && id ? <SketchColourSheet visible onClose={() => setSheet(null)} itemId={id} name={editor.name || cocktail?.name || ''} /> : null}
      {sheet === 'calc' ? <ToolsSheet visible onClose={() => setSheet(null)} tool="prep" prepName={editor.name} scheme={ds.scheme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  phoneBody: { gap: space.xl },
  name: { ...type.title, paddingVertical: space.xs },
  round: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  box: { ...type.body, ...font.regular, borderRadius: radius.control, padding: space.md, textAlignVertical: 'top' },
  wide: { flexDirection: 'row', gap: space.xxl, paddingHorizontal: space.xxl, paddingBottom: space.xxxl, alignItems: 'flex-start' },
  // The editor at the desk board's 640, the phone beside it.
  right: { flex: 1, maxWidth: 640, gap: space.xl },
});
