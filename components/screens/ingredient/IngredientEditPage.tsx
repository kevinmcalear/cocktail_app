import { usePreventRemove, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Chip, Field, FieldButton, Headline, PressableScale, Switch, TextLink, useDs, useGutter } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { SettingsRow } from '@/components/screens/settings/SettingsParts';
import { PrepCalcButton } from '@/components/tools/ToolsSheet';
import { displayFaces, layout, radius, space, type } from '@/constants/tokens';
import type { IngredientEditor } from '@/hooks/useIngredientEditor';
import { confirmDiscardChanges } from '@/lib/dialogs';
import { capitalize, capitalizeFirst, handleCapitalizedChange } from '@/lib/stringUtils';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { EditSpecList } from '../drink/edit/EditSpecList';
import { SpecPad } from '../drink/edit/SpecPad';
import { AccessSheet, FindSheet, SameNameNotice, TagsSheet } from './IngredientEditSheets';
import { usePictureTile } from './PictureTile';
import { EditorHead } from './PrepEditor';

interface Props {
  editor: IngredientEditor;
  /** What's being edited, over the name: INGREDIENT, PREP or DRAFT. */
  eyebrow: string;
  onBack: () => void;
  onSave: () => void;
  saveLabel?: string;
  /** A draft: make it an ingredient. */
  onPublish?: () => void;
  /** The ask-at-save sheet, when Save asks first. */
  children?: ReactNode;
}

type Open = { find: 'line' | 'kind' } | { find: 'swap'; at: number } | { sheet: 'tags' | 'access' } | null;

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Every field of an ingredient (PrepEditor's All fields, a bottle's Edit, a
 * draft from New > Drafts), in the prep editor's look: Back, what it is and
 * Save; the name in the venue's face beside its drawing; the recipe as the
 * drink editor's spec lines and pad; then what it is, its tags and who sees it.
 * The picture beside the name opens "Its picture" (PictureTile).
 */
export function IngredientEditPage(props: Props) {
  return (
    <VenueBrandProvider barId={props.editor.form.barId ?? undefined}>
      <Page {...props} />
    </VenueBrandProvider>
  );
}

function Page({ editor, eyebrow, onBack, onSave, saveLabel, onPublish, children }: Props) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { form, set } = editor;
  const [pad, setPad] = useState<number | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const lines = form.recipeItems;
  const setLine = (i: number, u: Partial<(typeof lines)[number]>) => editor.setRecipeItems((prev) => prev.map((l, j) => (j === i ? { ...l, ...u } : l)));
  const rows = editor.dropdowns?.ingredients ?? [];
  const aliases = editor.dropdowns?.ingredientAliases;
  const tags = (editor.dropdowns?.categories ?? []).filter((c) => c.domain === 'spirit').map((c) => ({ id: c.id, name: c.name ?? '' }));
  const picked = tags.filter((t) => form.selectedCategories.includes(t.id));
  const toggleTag = (id: string) => set({ selectedCategories: form.selectedCategories.includes(id) ? form.selectedCategories.filter((c) => c !== id) : [...form.selectedCategories, id] });
  // Its picture beside the name: a saved one's choice opens "Its picture"; a draft is drawn from its name.
  const picture = usePictureTile(editor);

  // A name nothing matches opens the add-ingredient wizard; the new one comes back onto this recipe.
  const makeNew = async (name: string) => {
    close();
    // A draft saves first, so coming back doesn't lose its recipe.
    if ('saveAsDraft' in editor && !(await editor.saveAsDraft(true))) return;
    router.push({ pathname: '/add-ingredient', params: { name, barId: form.barId || '', attachTo: editor.selfId || '' } });
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }]}>
        <EditorHead eyebrow={eyebrow} onBack={onBack} onSave={onSave} saving={editor.saving} saveLabel={saveLabel} />
        <View style={styles.nameRow}>
          <TextInput
            value={form.name}
            onChangeText={(name) => set({ name })}
            onBlur={() => set({ name: capitalizeFirst(form.name) })}
            aria-label="Name"
            placeholder="e.g. Rich Simple Syrup"
            placeholderTextColor={ds.c.faint}
            style={[type.title, styles.name, NO_OUTLINE, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink }]}
          />
          {picture.tile}
        </View>
        {picture.caption}
        <SameNameNotice name={form.name} barId={form.barId} rows={rows} aliases={aliases} excludeId={editor.selfId} generic={form.generic} onGeneric={(generic) => set({ generic })} />

        <View style={styles.section}>
          <Headline role="heading">Recipe</Headline>
          <EditSpecList
            items={lines}
            onReorder={editor.setRecipeItems}
            onRemove={(i) => editor.setRecipeItems((prev) => prev.filter((_, j) => j !== i))}
            onAmount={setPad}
            onSwap={(at) => setOpen({ find: 'swap', at })}
            onAdd={() => setOpen({ find: 'line' })}
          />
          <View style={styles.start}>
            <PrepCalcButton name={form.name} catalog={editor.catalog} recipe={lines} barId={form.barId} saveDraft={editor.saveDraft} onApply={editor.setRecipeItems} />
          </View>
        </View>

        <Field label="About it" value={form.description} onChangeText={(description) => set({ description })} placeholder="What it is and how it tastes" minLines={3} />

        <View style={styles.section}>
          <Headline role="heading">What it is</Headline>
          <Field
            label="Maker"
            value={form.brandMaker}
            onChangeText={(v) => handleCapitalizedChange(v, form.brandMaker, (brandMaker) => set({ brandMaker }))}
            onBlur={() => set({ brandMaker: capitalize(form.brandMaker) })}
            placeholder="e.g. Campari, Buffalo Trace"
            maxLength={80}
          />
          <KindOf name={form.generic?.name ?? null} onPick={() => setOpen({ find: 'kind' })} onClear={() => set({ generic: null })} />
          <Field label="ABV (%)" value={form.abv} onChangeText={(abv) => set({ abv: abv.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" placeholder="e.g. 40" maxLength={5} />
        </View>

        <View style={styles.section}>
          <View style={styles.headRow}>
            <Headline role="heading">Spirit tags</Headline>
            <TextLink label="+ Add" onPress={() => setOpen({ sheet: 'tags' })} accessibilityHint="Choose spirit tags" />
          </View>
          {picked.length ? (
            <View style={styles.chips}>
              {picked.map((t) => (
                <Chip key={t.id} label={t.name} selected multi onPress={() => toggleTag(t.id)} accessibilityLabel={`${t.name}, remove`} />
              ))}
            </View>
          ) : (
            <Caption tone="muted">No tags yet</Caption>
          )}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Body>Hide in search</Body>
            <Caption tone="muted">Keep it out of ⌘K. It can still go in recipes.</Caption>
          </View>
          <Switch value={form.hideFromSearch} onValueChange={(hideFromSearch) => set({ hideFromSearch })} label="Hide in search" />
        </View>
        <SettingsRow label="Who can see it" detail="The venue it belongs to, and what each role sees" role="button" onPress={() => setOpen({ sheet: 'access' })} />
        {onPublish ? <Button label="Publish ingredient" size="lg" disabled={editor.saving} onPress={onPublish} /> : null}
      </FormScrollContainer>

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
            setOpen({ find: 'swap', at: pad });
            setPad(null);
          }}
          onClose={() => setPad(null)}
        />
      ) : null}
      {open && 'find' in open ? (
        <FindSheet
          title={open.find === 'kind' ? 'What it’s a kind of' : open.find === 'swap' ? `Swap ${lines[open.at]?.name ?? 'it'} for…` : 'Add an ingredient'}
          ingredients={open.find === 'kind' ? rows : editor.catalog}
          aliases={aliases}
          loading={!editor.dropdowns?.ingredients}
          excludeId={editor.selfId}
          allowNew={open.find !== 'kind'}
          onClose={close}
          onNew={(name) => void makeNew(name)}
          onPick={(p) => {
            close();
            if (open.find === 'kind') return set({ generic: p });
            if (open.find === 'swap') return setLine(open.at, { ingredient_id: p.id, name: p.name });
            // A new line goes straight to its amount.
            editor.setRecipeItems((prev) => [...prev, { ingredient_id: p.id, name: p.name, amount: '', unit: getPreferredUnit(), preparation_notes: '', is_optional: false }]);
            setPad(lines.length);
          }}
        />
      ) : null}
      {open && 'sheet' in open && open.sheet === 'tags' ? <TagsSheet tags={tags} selected={form.selectedCategories} onToggle={toggleTag} onClose={close} /> : null}
      {open && 'sheet' in open && open.sheet === 'access' ? <AccessSheet form={form} set={set} onClose={close} /> : null}
      {picture.sheet}
      {children}
    </View>
  );
}

/**
 * Ask before leaving with unsaved changes, by Back or a swipe (on the web,
 * closing the tab too). Returns what lets the page go once it's saved.
 */
export function useLeaveGuard(dirty: boolean) {
  // repeat() lifts the guard itself before it goes on.
  return usePreventRemove(dirty, ({ repeat }) => void confirmDiscardChanges(true).then((ok) => ok && repeat()));
}

/** What it's a kind of ("Tanqueray" is a kind of Gin): opens the search; x clears it. */
function KindOf({ name, onPick, onClear }: { name: string | null; onPick: () => void; onClear: () => void }) {
  const ds = useDs();
  return (
    <View style={styles.kind}>
      <Caption tone="muted">Kind of</Caption>
      <View>
        <PressableScale role="button" accessibilityLabel={name ? `Kind of ${name}. Change it` : 'Choose what it’s a kind of'} onPress={onPick} style={[styles.kindBox, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
          <Body tone={name ? undefined : 'muted'} numberOfLines={1}>
            {name ?? 'e.g. Gin, Sweet Vermouth'}
          </Body>
        </PressableScale>
        {name ? (
          <View style={styles.clear}>
            <FieldButton icon="xmark.circle.fill" label="Clear what it’s a kind of" onPress={onClear} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: layout.page.text, alignSelf: 'center', gap: space.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { flex: 1, minWidth: 0, paddingVertical: space.xs },
  section: { gap: space.sm },
  start: { alignItems: 'flex-start', paddingTop: space.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  kind: { gap: space.xs },
  kindBox: { minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, paddingRight: layout.minTapTarget, justifyContent: 'center' },
  clear: { position: 'absolute', top: 0, bottom: 0, right: 0, justifyContent: 'center' },
});
