import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { Crumbs, type Crumb } from '@/components/nav/PageFrame';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { usePrepCalc } from '@/components/tools/ToolsSheet';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import type { useIngredientDraftEditor } from '@/hooks/useIngredientEditor';
import { useIngredient } from '@/hooks/useIngredients';
import { useMode } from '@/hooks/useMode';
import { useHoldUpdates } from '@/hooks/useOtaUpdates';
import { confirmAsync } from '@/lib/dialogs';
import { ingredientHeroPictures, shownIngredientPicture } from '@/lib/ingredientPicture';
import { orderedPictures } from '@/lib/itemImages';
import { newStepField } from '@/lib/prepCardForm';
import { toastDone } from '@/lib/toast';

import { EditBrand } from '../../drink/edit/DrinkEditScreen';
import { EditBottomBar, EditMoreMenu, type MoreChoice } from '../../drink/edit/EditParts';
import { EditToolbar } from '../../drink/edit/EditToolbar';
import { useAskAtSave } from '../AskAtSave';
import { IngredientHero } from '../IngredientBits';
import { EditBody, type BodySheet } from './EditBody';
import { useGiveItASpot, useLeaveGuard } from './EditSections';
import { EditSheets } from './EditSheets';
import { KeepsRows } from './PrepSections';
import { useIngredientDraftEdit, useIngredientEdit, type IngredientEdit } from './useIngredientEdit';

const PHONE_HERO = 280;

/**
 * Editing an ingredient in place (ingredient-edit-proposal, approved 24 Oct):
 * the ingredient page itself, every field where it reads, with the drink
 * editor's toolbar (undo, redo, Editing, Done) and spec lines. A house prep
 * edits its recipe, method, how it keeps, where it lives and who sees it; a
 * bottle what it is, its tags, where it lives, its price and who sees it.
 * Done saves; a prep other drinks use asks first (AskAtSave).
 */
export function IngredientEditScreen({ id, onExit }: { id: string; onExit: () => void }) {
  const edit = useIngredientEdit(id);
  return (
    <EditBrand barId={useIngredient(id).data?.ingredient?.bar_id}>
      <Page edit={edit} savedId={id} onExit={onExit} />
    </EditBrand>
  );
}

/** A draft from New > Drafts on the same page: Done keeps it a draft, More publishes it. */
export function IngredientDraftEditScreen({ draft, onExit }: { draft: Parameters<typeof useIngredientDraftEditor>[0]; onExit: () => void }) {
  const edit = useIngredientDraftEdit(draft);
  return (
    <EditBrand barId={edit.editor.form.barId}>
      <Page edit={edit} savedId={null} onExit={onExit} />
    </EditBrand>
  );
}

type Sheet = MoreChoice | BodySheet | 'more' | null;

function Page({ edit, savedId, onExit }: { edit: IngredientEdit; savedId: string | null; onExit: () => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const top = Platform.OS === 'ios' ? space.sm : insets.top;
  const { editor, prep, setPrep, history } = edit;
  const { form } = editor;
  const draft = 'publish' in editor ? editor : null;
  const selfId = savedId ?? editor.draftId ?? '';
  const { data } = useIngredient(savedId ?? undefined);
  const { venues } = useActiveVenue();
  const home = useMode().mode === 'home';
  useHoldUpdates();

  const [sheet, setSheet] = useState<Sheet>(null);
  // The bottom bar's Line puts the cursor in the search under the recipe.
  const [focus, setFocus] = useState(0);
  const lines = form.recipeItems;
  const name = form.name || data?.ingredient?.name || 'Ingredient';
  const calc = usePrepCalc({ name: form.name, catalog: editor.catalog, recipe: lines, barId: form.barId, saveDraft: editor.saveDraft, onApply: editor.setRecipeItems });
  const giveItASpot = useGiveItASpot(selfId, name);

  const allowExit = useLeaveGuard(edit.dirty);
  const finish = async () => {
    if (!(await edit.save())) return;
    toastDone(draft ? 'Draft saved' : 'Ingredient saved', form.name.trim());
    allowExit();
    onExit();
  };
  const askAtSave = useAskAtSave(savedId ?? '', { name: form.name, description: form.description, abv: form.abv, lines }, () => void finish());
  const done = () => (!edit.dirty ? onExit() : askAtSave.ask() ? undefined : void finish());
  const leave = async () => {
    if (edit.dirty && !(await confirmAsync({ title: 'Discard your changes?', message: 'Nothing you changed here is saved yet.', confirmText: 'Discard', destructive: true }))) return;
    edit.discard();
    allowExit();
    onExit();
  };
  const publish = async () => {
    if (!draft || !(await confirmAsync({ title: 'Publish ingredient', message: 'Are you sure you want to publish this ingredient?', confirmText: 'Publish' }))) return;
    const id = await draft.publish();
    if (!id) return;
    toastDone('Ingredient saved', form.name.trim());
    allowExit();
    // Back to whoever opened it: an editor waiting for it (attachTo) picks it up there.
    onExit();
  };
  const removeDraft = async () => {
    if (!draft?.draftId || !(await confirmAsync({ title: 'Delete draft?', message: 'This draft goes for good.', confirmText: 'Delete', destructive: true }))) return;
    await draft.deleteDraft(draft.draftId);
    allowExit();
    onExit();
  };
  const onMore = (c: MoreChoice) => (c === 'discard' ? void leave() : c === 'publish' ? void publish() : c === 'delete' ? void removeDraft() : setSheet(c));

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

  if (edit.loading || !prep) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: ds.c.ground }]} accessibilityLabel="Loading ingredient">
        <ActivityIndicator color={ds.c.muted} />
      </View>
    );
  }

  const isPrep = lines.length > 0 || editor.role === 'prep' || !!edit.card?.prep || !!edit.card?.steps.length;
  const pictures = ingredientHeroPictures(shownIngredientPicture(form.picture, form.photo), orderedPictures(data?.heroImages));
  const spiritTags = (editor.dropdowns?.categories ?? []).filter((c) => c.domain === 'spirit').map((c) => ({ id: c.id, name: c.name ?? '' }));
  const addStep = () => setPrep({ steps: [...prep.steps, newStepField()] });

  const hero = (height: number) => (
    <View>
      {pictures ? <IngredientHero id={selfId} name={name} pictures={pictures} height={height} fade={!wide} /> : <View style={{ height: wide ? space.xxxl * 2 : top + 120, backgroundColor: ds.c.paper }} />}
      {editor.canChoosePicture ? (
        <View style={[styles.heroButtons, { bottom: wide ? space.lg : space.xxl + space.md }]}>
          <GlassButton accessibilityLabel="Its picture" icon="photo" label="Its picture" onMedia onPress={() => setSheet('photos')} />
          {form.picture === 'photo' ? null : <GlassButton accessibilityLabel="Add a photo" icon="camera" label="Add a photo" onMedia onPress={() => setSheet('photos')} />}
        </View>
      ) : null}
    </View>
  );
  const body = <EditBody edit={edit} savedId={savedId} isPrep={isPrep} wide={wide} venueName={venues.find((v) => v.id === form.barId)?.name ?? null} used={data?.usedIn?.length ?? 0} spiritTags={spiritTags} onSheet={setSheet} selfId={selfId} focus={focus} />;
  const toolbar = <EditToolbar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} changes={history.changes} onDone={done} saving={edit.saving} wide={wide} media={pictures?.length ? 'photo' : 'paper'} more={wide ? <GlassButton accessibilityLabel="More" icon="ellipsis" onPress={() => setSheet('more')} /> : undefined} />;
  const trail: Crumb[] = home ? [{ label: 'My Bar', href: '/bar' }] : [{ label: 'Library', href: '/library' }, { label: isPrep ? 'House-made' : 'Ingredients', href: '/library' }];
  const canSpot = !!savedId && !home;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: top + space.lg, paddingBottom: space.xxxl, gap: space.lg }}>
          <View style={styles.headRow}>
            <Crumbs trail={savedId ? [...trail, { label: name, href: `/ingredient/${savedId}` as Href }] : trail} />
            <View style={styles.flex}>{toolbar}</View>
          </View>
          <View style={styles.wideRow}>
            <View style={styles.aside}>
              <View style={styles.card}>{hero(340)}</View>
              {isPrep && savedId ? <KeepsRows fields={prep} wide onOpen={setSheet} /> : null}
            </View>
            <View style={styles.main}>{body}</View>
          </View>
        </FormScrollContainer>
      ) : (
        <>
          <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
            {hero(PHONE_HERO + top)}
            <View style={[styles.phoneBody, { backgroundColor: ds.c.ground, paddingHorizontal: gutter }]}>{body}</View>
          </FormScrollContainer>
          <View style={[styles.float, { top: top + space.sm, left: gutter, right: gutter }]}>{toolbar}</View>
          <View style={[styles.float, { bottom: insets.bottom + space.md, left: gutter, right: gutter }]}>
            {isPrep ? (
              <EditBottomBar onLine={() => setFocus(focus + 1)} lineHint="Add a line to the recipe" onStep={savedId ? addStep : undefined} onCalc={calc.open} onMore={() => setSheet('more')} moreHint="More: its picture, who can see it, discard" />
            ) : (
              <EditBottomBar onPhoto={editor.canChoosePicture ? () => setSheet('photos') : undefined} onSpot={canSpot ? giveItASpot : undefined} onMore={() => setSheet('more')} moreHint="More: its picture, who can see it, discard" />
            )}
          </View>
        </>
      )}

      <EditSheets edit={edit} selfId={selfId} name={name} sheet={sheet} onSheet={setSheet} spiritTags={spiritTags} />
      <EditMoreMenu open={sheet === 'more'} onClose={() => setSheet(null)} canDelete={!!draft} dirty={edit.dirty} draft={!!draft} onPick={onMore} noun="ingredient" photosLabel="Its picture" />
      {calc.sheet}
      {askAtSave.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  // Its picture at the left, Add a photo at the right (ingredient-edit-proposal).
  heroButtons: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  phoneBody: { gap: space.xl, marginTop: -space.lg, paddingTop: space.lg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  float: { position: 'absolute' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  aside: { width: 340, gap: space.md },
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, maxWidth: 680, gap: space.xl },
});
