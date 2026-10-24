import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { Crumbs } from '@/components/nav/PageFrame';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { usePrepCalc } from '@/components/tools/ToolsSheet';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIngredient } from '@/hooks/useIngredients';
import { useMode } from '@/hooks/useMode';
import { useHoldUpdates } from '@/hooks/useOtaUpdates';
import { confirmAsync } from '@/lib/dialogs';
import { ingredientHeroPictures, shownIngredientPicture } from '@/lib/ingredientPicture';
import { orderedPictures } from '@/lib/itemImages';
import { newStepField } from '@/lib/prepCardForm';
import { toastDone } from '@/lib/toast';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { EditBrand } from '../../drink/edit/DrinkEditScreen';
import { AccessSheet, EditBottomBar, EditMoreMenu, type MoreChoice } from '../../drink/edit/EditParts';
import { EditSpecList } from '../../drink/edit/EditSpecList';
import { EditToolbar } from '../../drink/edit/EditToolbar';
import { SpecPad } from '../../drink/edit/SpecPad';
import { useAskAtSave } from '../AskAtSave';
import { IngredientHero, IngredientTags } from '../IngredientBits';
import { FindSheet } from '../IngredientEditSheets';
import { useLeaveGuard } from '../IngredientEditPage';
import { PictureSheet } from '../PictureSheet';
import { KindOf, NameField, WhereEdit, WhoSees } from './EditSections';
import { MethodEdit } from './MethodEdit';
import { keepsValues, KeepsRows, KeepsSheet, PrepCost, type KeepsField } from './PrepSections';
import { useIngredientEdit } from './useIngredientEdit';

const PHONE_HERO = 280;

/**
 * Editing an ingredient in place (ingredient-edit-proposal, approved 24 Oct):
 * the ingredient page itself, every field where it reads, with the drink
 * editor's toolbar (undo, redo, Editing, Done) and spec lines. A house prep
 * edits its recipe, method, how it keeps, where it lives and who sees it, and
 * shows its cost from its parts. Done saves; a prep other drinks use asks
 * first (AskAtSave). Replaces the separate Back / Save page.
 */
export function IngredientEditScreen({ id, onExit }: { id: string; onExit: () => void }) {
  return (
    <EditBrand barId={useIngredient(id).data?.ingredient?.bar_id}>
      <Page id={id} onExit={onExit} />
    </EditBrand>
  );
}

type Sheet = MoreChoice | KeepsField | 'more' | 'kind' | 'line' | null;

function Page({ id, onExit }: { id: string; onExit: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const top = Platform.OS === 'ios' ? space.sm : insets.top;
  const edit = useIngredientEdit(id);
  const { editor, prep, setPrep, history } = edit;
  const { form, set } = editor;
  const { data } = useIngredient(id);
  const ingredient = data?.ingredient;
  const { venues } = useActiveVenue();
  const home = useMode().mode === 'home';
  useHoldUpdates();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [pad, setPad] = useState<number | null>(null);
  const [swap, setSwap] = useState<number | null>(null);
  const lines = form.recipeItems;
  const setLine = (i: number, u: Partial<(typeof lines)[number]>) => editor.setRecipeItems((prev) => prev.map((l, j) => (j === i ? { ...l, ...u } : l)));
  const calc = usePrepCalc({ name: form.name, catalog: editor.catalog, recipe: lines, barId: form.barId, saveDraft: editor.saveDraft, onApply: editor.setRecipeItems });

  const allowExit = useLeaveGuard(edit.dirty);
  const finish = async () => {
    if (!(await edit.save())) return;
    toastDone('Ingredient saved', form.name.trim());
    allowExit();
    onExit();
  };
  const askAtSave = useAskAtSave(id, { name: form.name, description: form.description, abv: form.abv, lines }, () => void finish());
  const done = () => (!edit.dirty ? onExit() : askAtSave.ask() ? undefined : void finish());
  const leave = async () => {
    if (edit.dirty && !(await confirmAsync({ title: 'Discard your changes?', message: 'Nothing you changed here is saved yet.', confirmText: 'Discard', destructive: true }))) return;
    edit.discard();
    allowExit();
    onExit();
  };
  const onMore = (c: MoreChoice) => (c === 'discard' ? void leave() : setSheet(c));

  // The web: ⌘↵ is Done, ⌘Z and ⇧⌘Z undo and redo outside a text field, Escape leaves (as the drink editor).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 'Enter') return void (e.preventDefault(), done());
      if (cmd && !typing && e.key.toLowerCase() === 'z') return void (e.preventDefault(), e.shiftKey ? history.redo() : history.undo());
      if (e.key === 'Escape' && !typing && pad === null && !sheet && swap === null) void leave();
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
  const venueName = venues.find((v) => v.id === form.barId)?.name ?? null;
  const name = form.name || ingredient?.name || 'Ingredient';
  const shown = shownIngredientPicture(form.picture, form.photo);
  const pictures = ingredientHeroPictures(shown, orderedPictures(data?.heroImages));
  const used = data?.usedIn?.length ?? 0;
  const makes = keepsValues(prep).makes;
  const steps = prep.steps.filter((s) => s.body.trim()).length;
  const methodSummary = [steps ? `${steps} ${steps === 1 ? 'step' : 'steps'}` : null, keepsValues(prep).takes].filter(Boolean).join(' · ') || null;
  const addLine = () => setSheet('line');
  const addStep = () => setPrep({ steps: [...prep.steps, newStepField()] });

  const hero = (height: number) => (
    <View>
      {pictures ? <IngredientHero id={id} name={name} pictures={pictures} height={height} fade={!wide} /> : <View style={{ height: wide ? space.xxxl * 2 : top + 120, backgroundColor: ds.c.paper }} />}
      {editor.canChoosePicture ? (
        <View style={[styles.heroButtons, { bottom: wide ? space.lg : space.xxl + space.md }]}>
          <GlassButton accessibilityLabel="Its picture" icon="photo" label="Its picture" onMedia onPress={() => setSheet('photos')} />
          {form.picture === 'photo' ? null : <GlassButton accessibilityLabel="Add a photo" icon="camera" label="Add a photo" onMedia onPress={() => setSheet('photos')} />}
        </View>
      ) : null}
    </View>
  );
  const words = (
    <>
      {wide ? null : <NameField value={form.name} onChange={(n) => set({ name: n })} />}
      <IngredientTags isPrep={isPrep} actions={[]} venueName={venueName} shared={!form.barId} mine={false} role={editor.role} technical={false} />
      {wide ? <NameField value={form.name} onChange={(n) => set({ name: n })} /> : null}
      <KindOf name={form.generic?.name ?? null} onPick={() => setSheet('kind')} onClear={() => set({ generic: null })} />
      <Field label="About it" value={form.description} onChangeText={(description) => set({ description })} placeholder="What it is and how it tastes" minLines={3} />
    </>
  );
  const body = (
    <>
      {isPrep ? (
        <EditSpecList
          title="Recipe"
          aside={makes ? `Makes about ${makes}` : null}
          note={used ? `The ${used === 1 ? 'drink' : `${used} drinks`} that use it update when you press Done.` : null}
          items={lines}
          onReorder={editor.setRecipeItems}
          onRemove={(i) => editor.setRecipeItems((prev) => prev.filter((_, j) => j !== i))}
          onAmount={setPad}
          onSwap={setSwap}
          onAdd={addLine}
        />
      ) : null}
      {isPrep ? <MethodEdit steps={prep.steps} onChange={(s) => setPrep({ steps: s })} summary={methodSummary} /> : null}
      {isPrep && !wide ? <KeepsRows fields={prep} wide={false} onOpen={setSheet} /> : null}
      {isPrep ? <PrepCost itemId={id} fields={prep} lines={lines} /> : null}
      <WhereEdit itemId={id} name={name} />
      <WhoSees itemId={id} barId={form.barId} hide={form.hideFromSearch} onHide={(hideFromSearch) => set({ hideFromSearch })} />
    </>
  );
  const toolbar = <EditToolbar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} onDone={done} saving={edit.saving} wide={wide} media={pictures?.length ? 'photo' : 'paper'} more={wide ? <GlassButton accessibilityLabel="More" icon="ellipsis" onPress={() => setSheet('more')} /> : undefined} />;
  const trail = home ? [{ label: 'My Bar', href: '/bar' }] : [{ label: 'Library', href: '/library' }, { label: isPrep ? 'Preps' : 'Ingredients', href: '/library' }];

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: top + space.lg, paddingBottom: space.xxxl, gap: space.lg }}>
          <View style={styles.headRow}>
            <Crumbs trail={[...trail, { label: name, href: `/ingredient/${id}` }]} />
            <View style={styles.flex}>{toolbar}</View>
          </View>
          <View style={styles.wideRow}>
            <View style={styles.aside}>
              <View style={styles.card}>{hero(340)}</View>
              {isPrep ? <KeepsRows fields={prep} wide onOpen={setSheet} /> : null}
            </View>
            <View style={styles.main}>
              {words}
              {body}
            </View>
          </View>
        </FormScrollContainer>
      ) : (
        <>
          <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
            {hero(PHONE_HERO + top)}
            <View style={[styles.phoneBody, { backgroundColor: ds.c.ground, paddingHorizontal: gutter }]}>
              {words}
              {body}
            </View>
          </FormScrollContainer>
          <View style={[styles.float, { top: top + space.sm, left: gutter, right: gutter }]}>{toolbar}</View>
          <View style={[styles.float, { bottom: insets.bottom + space.md, left: gutter, right: gutter }]}>
            <EditBottomBar onLine={isPrep ? addLine : undefined} lineHint="Add a line to the recipe" onStep={isPrep ? addStep : undefined} onCalc={isPrep ? calc.open : undefined} onMore={() => setSheet('more')} moreHint="More: its picture, who can see it, discard" />
          </View>
        </>
      )}

      {pad !== null && lines[pad] ? (
        <SpecPad key={pad} line={lines[pad]} index={pad} count={lines.length} nextName={lines[pad + 1]?.name ?? null} onChange={(u) => setLine(pad, u)} onNext={() => setPad(pad + 1 < lines.length ? pad + 1 : null)} onSwap={() => (setSwap(pad), setPad(null))} onClose={() => setPad(null)} />
      ) : null}
      {sheet === 'line' || sheet === 'kind' || swap !== null ? (
        <FindSheet
          title={sheet === 'kind' ? 'What it’s a kind of' : swap !== null ? `Swap ${lines[swap]?.name ?? 'it'} for…` : 'Add an ingredient'}
          ingredients={sheet === 'kind' ? (editor.dropdowns?.ingredients ?? []) : editor.catalog}
          aliases={editor.dropdowns?.ingredientAliases}
          loading={!editor.dropdowns?.ingredients}
          excludeId={id}
          allowNew={sheet !== 'kind'}
          onClose={() => (setSheet(null), setSwap(null))}
          onNew={(n) => (setSheet(null), setSwap(null), router.push({ pathname: '/add-ingredient', params: { name: n, barId: form.barId || '', attachTo: id } }))}
          onPick={(p) => {
            const at = swap;
            setSheet(null);
            setSwap(null);
            if (sheet === 'kind') return set({ generic: p });
            if (at !== null) return setLine(at, { ingredient_id: p.id, name: p.name });
            // A new line goes straight to its amount.
            editor.setRecipeItems((prev) => [...prev, { ingredient_id: p.id, name: p.name, amount: '', unit: getPreferredUnit(), preparation_notes: '', is_optional: false }]);
            setPad(lines.length);
          }}
        />
      ) : null}
      {sheet === 'makes' || sheet === 'keeps' || sheet === 'store' || sheet === 'takes' || sheet === 'how' ? <KeepsSheet field={sheet} fields={prep} set={setPrep} onClose={() => setSheet(null)} /> : null}
      <EditMoreMenu open={sheet === 'more'} onClose={() => setSheet(null)} canDelete={false} dirty={edit.dirty} onPick={onMore} noun="ingredient" photosLabel="Its picture" />
      {sheet === 'photos' && editor.canChoosePicture ? <PictureSheet itemId={id} name={name} value={{ picture: form.picture, photo: form.photo }} onDone={(c) => set(c)} onClose={() => setSheet(null)} /> : null}
      {sheet === 'access' ? <AccessSheet editor={accessOf(form, set)} onClose={() => setSheet(null)} noun="ingredient" /> : null}
      {calc.sheet}
      {askAtSave.sheet}
    </View>
  );
}

/** The drink editor's access sheet, over the ingredient form. */
function accessOf(form: ReturnType<typeof useIngredientEdit>['editor']['form'], set: (patch: Partial<typeof form>) => void) {
  return {
    barId: form.barId,
    setBarId: (barId: string | null) => set({ barId }),
    overrideVisibility: form.overrideVisibility,
    setOverrideVisibility: (overrideVisibility: string | null) => set({ overrideVisibility }),
    overrideGeneric: form.overrideGeneric,
    setOverrideGeneric: (overrideGeneric: string | null) => set({ overrideGeneric }),
    overrideSpecific: form.overrideSpecific,
    setOverrideSpecific: (overrideSpecific: string | null) => set({ overrideSpecific }),
    overrideMeasurement: form.overrideMeasurement,
    setOverrideMeasurement: (overrideMeasurement: string | null) => set({ overrideMeasurement }),
    overridePrep: form.overridePrep,
    setOverridePrep: (overridePrep: string | null) => set({ overridePrep }),
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  heroButtons: { position: 'absolute', right: space.lg, flexDirection: 'row', gap: space.sm },
  phoneBody: { gap: space.xl, marginTop: -space.lg, paddingTop: space.lg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  float: { position: 'absolute' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  aside: { width: 340, gap: space.md },
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, maxWidth: 680, gap: space.xl },
});
