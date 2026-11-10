import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Field, useDs, useGutter } from '@/components/ds';
import { DragScrollView } from '@/components/ds/dragScroll';
import { ListNote } from '@/components/ds/ListGroup';
import { layout, radius, space } from '@/constants/tokens';
import { takenPartWords, useSameNamePrep } from '@/hooks/useSameNamePrep';
import { MOST_LEVELS } from '@/lib/houseMadeParts';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { withFacts, type PrepDraft, type PrepPick } from '@/lib/prepKinds';
import { looksMadeInHouse } from '@/lib/techniques/makeIt';

import type { CatalogIngredient } from '../IngredientSearch';
import { Prompt } from '../Prompt';
import { trailInto, type TrailItem } from '../Trail';
import { KeyboardScreen } from '../WizardFrame';
import { PageHead } from './PageHead';
import { PrepRecipeStep } from './PrepRecipeStep';
import { PrepRows } from './PrepRows';
import { useInside } from './useInside';
import { usePrepDraft } from './usePrepDraft';

export interface PartPageProps {
  /** The part's name, as its line says it ("Honey-ginger syrup"). */
  name: string;
  /** Its recipe so far, when it has one. */
  initial: PrepDraft | null;
  /** What it's a part of ("Penicillin batch"): the eyebrow says so. */
  parent: string;
  /** The house-made at the top (or the drink it's in), the page's title. */
  top: string;
  /** The levels above it, from the top: the trail, each a way back up. */
  above: readonly TrailItem[];
  /** 1 for a house-made inside a drink (Add-inside), 2 for a part, 3 for a part of a part: the most (Add-parts, 3). */
  level: number;
  bar: { id: string; name: string } | null;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  /** On the web's dialog, under its line in place (Add-parts, Web), not a page of its own. */
  inPlace?: boolean;
  /** A page of its own over what it's in, or a panel beside the drink on the web's desktop page (Add-inside, Web). */
  frame?: 'page' | 'panel';
  /** Each change, on its line as it's made: the draft keeps it, offline too. `done` says it could be added as it is. */
  onKeep: (prep: PrepDraft, name: string, done: boolean) => void;
  /** The check, or Close the part: on its line, back to the level above. */
  onDone: (prep: PrepDraft, name: string) => void;
  /** Gone, as it was left: what's done stays on its line (Back comes here). */
  onClose: () => void;
  /** Back, when it asks first (Add-inside: "Leave it for now?"); otherwise Back is onClose. */
  onBack?: () => void;
  /** The drink's check (Add-inside, Saving with the drink): the top check saves the drink with it, "Saving…" while it does. */
  save?: { onSave: (prep: PrepDraft, name: string) => void; saving: boolean; canSave: boolean };
  /** In a native Modal, Android's back goes to the Modal: it calls this, the level showing's Back. */
  backRef?: RefObject<(() => void) | null>;
  /** Its name is taken here, Use yours: the line uses that one. */
  onUse: (id: string, name: string) => void;
  /** The top's own words (Add-inside 2: "House-made · draft, inside the drink"). */
  eyebrow?: string;
  doneLabel?: string;
  /** Under the rows (Add-inside: "Saves with the drink…", or the offline note). */
  note?: ReactNode;
  /** No lines yet (Add-inside, Empty): what to do. */
  empty?: string;
  /** Make it house from a line: the bottle it changes, and the technique picked for it. */
  picked?: { base?: PrepPick | null; adjunct?: PrepPick | null };
  technique?: string | null;
  /** Two lines just combined: they're its lines, as measured. */
  combined?: boolean;
}

/**
 * A house-made written inside what it goes in, one flat page (boards
 * Add-parts 2 and 3, Add-inside 2): the trail, its lines and the search, then
 * What it is, Method, Makes and Keeps as rows, each opening its step. A
 * line that's not one of yours yet can be made here too, one more level in,
 * three levels at most. On the web's dialog a part opens under its line
 * instead (Add-parts, Web); on the web's desktop page a house-made in a
 * drink is a panel beside it (Add-inside, Web).
 */
export function PartPage(p: PartPageProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const [name, setName] = useState(p.name);
  const [renaming, setRenaming] = useState(false);
  const { draft, changed, setDraft, view, pickKind, pickTechnique, phrase, version, named, slotsOpen } = usePrepDraft({ name: p.name, nameNow: name, initial: p.initial, picked: p.picked, technique: p.technique, combined: p.combined, bar: p.bar, measured: true, blank: true });
  const shown = name.trim() || p.name;
  const inside = useInside(draft, setDraft);
  const last = p.level >= MOST_LEVELS;

  // Board Add-parts, 6: a part named like one you have: Use yours first, or make a new one.
  const same = useSameNamePrep({ barId: p.bar?.id ?? null, name: shown });
  const taken = same.data;
  // A line that isn't one of yours yet: added by its name alone, or it sounds made (Add-parts, 2: "To make").
  const toMake = last ? undefined : draft.lines.find((l) => !l.id && !l.prep && !l.slot && !l.bottle && l.name.trim() && (l.toMake || looksMadeInHouse(l.name)));
  const canDone = named && !slotsOpen && !!shown.trim() && !taken;
  const done = () => p.onDone(withFacts(draft), shown);
  const back = p.onBack ?? p.onClose;
  const trail = trailInto(p.above, back, shown);

  // Android's back: the level showing goes back, one at a time. In a Modal it goes to the Modal, which asks backRef.
  const nested = !!inside.props;
  const { backRef } = p;
  useEffect(() => {
    if (p.inPlace || nested) return;
    if (backRef) {
      backRef.current = back;
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (back(), true));
    return () => sub.remove();
  }, [back, backRef, p.inPlace, nested]);
  // What's written goes on its line as it's written, so leaving the whole house-made keeps it. Not while its name is
  // taken (or still being checked): Back then leaves the line as it was, and the save can't fail on it later.
  const free = !taken && !same.checking;
  useEffect(() => {
    if (free && (changed() || name !== p.name)) p.onKeep(withFacts(draft), shown, named && !slotsOpen && !!shown.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kept when what it keeps changes
  }, [draft, name, free]);
  const words = taken ? takenPartWords(taken, p.bar?.name ?? null) : null;

  const below = (level: number, inPlace: boolean) => (inside.props && inside.line ? (
    <PartPage
      key={inside.line.key}
      name={inside.props.name}
      initial={inside.props.initial}
      parent={shown}
      top={p.top}
      above={trail}
      level={level}
      bar={p.bar}
      ingredients={p.ingredients}
      aliases={p.aliases}
      inPlace={inPlace}
      frame={p.frame}
      backRef={backRef}
      onKeep={inside.keep}
      onDone={inside.props.onDone}
      onClose={inside.props.onClose}
      onUse={inside.use}
    />
  ) : null);
  // A phone (and the desktop page's panel) goes one level in as a page of its own.
  if (!p.inPlace && inside.props) return below(p.level + 1, false);

  const body = (
    <View style={styles.stack}>
      {words ? (
        <Prompt
          warn
          ink
          icon="exclamationmark.triangle"
          title={words.title}
          body={words.body}
          actions={[
            { label: words.use, onPress: () => p.onUse(taken!.id, taken!.name), accessibilityLabel: `${words.use}: ${taken!.name}, in ${p.parent}` },
            { label: 'Make a new one', onPress: () => setRenaming(true) },
          ]}
        />
      ) : null}
      {renaming ? <Field label="Name" value={name} onChangeText={setName} autoFocus maxLength={80} returnKeyType="done" /> : null}
      {p.empty && !draft.lines.length ? <ListNote icon="flask" text={p.empty} /> : null}
      <PrepRecipeStep key={`recipe-${version}`} draft={draft} view={view} set={(c) => setDraft({ ...draft, ...c })} ingredients={p.ingredients} aliases={p.aliases} onMake={last ? undefined : inside.open} parts flat openKey={p.inPlace ? inside.line?.key : null} below={p.inPlace ? (l) => (l.key === inside.line?.key ? below(p.level + 1, true) : null) : undefined} />
      {toMake && !p.inPlace ? (
        <Prompt
          icon="sparkles"
          title={`${toMake.name} isn’t one of yours yet.`}
          body="Make it here too, one more level in. Back comes here."
          actions={[{ label: `Make ${toMake.name} here`, onPress: () => inside.open(toMake.key) }]}
        />
      ) : null}
      {last ? <Prompt warn icon="exclamationmark.triangle" title="Three levels is the most." body="A part that needs its own parts opens on its own page." /> : null}
      <PrepRows name={shown} draft={draft} set={(c) => setDraft({ ...draft, ...c })} version={version} phrase={phrase} onKind={pickKind} onTechnique={pickTechnique} bar={p.bar} inPlace={p.inPlace} />
      {p.note}
    </View>
  );

  if (p.inPlace) {
    return (
      <View role="group" aria-label={`${shown}, a part of ${p.parent}`} style={[styles.panel, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
        <Body>{`${shown} · a part, opened under its line`}</Body>
        <Caption tone="muted">{`Its lines, the same as a page of its own.${toMake ? ` ${toMake.name} opens one more level in, here.` : ''}`}</Caption>
        {body}
        {/* One Close at a time, the innermost part's: an outer one closed first would leave the inner part a bare name. */}
        {nested ? null : (
          <View style={styles.buttons}>
            {toMake ? <Button label={`Make ${toMake.name} here`} onPress={() => inside.open(toMake.key)} /> : null}
            {/* Not done yet (no lines, its name taken): closing it is the phone's Back, and what's done stays on its line. */}
            <Button label="Close the part" variant={toMake ? 'secondary' : 'primary'} onPress={canDone ? done : p.onClose} />
          </View>
        )}
      </View>
    );
  }
  const { save } = p;
  const head = (
    <PageHead
      trail={trail}
      drinkName={p.top}
      name={shown}
      canAdd={canDone && (!save || (save.canSave && !save.saving))}
      busy={save?.saving ? 'Saving…' : undefined}
      onBack={back}
      onDone={save ? () => save.onSave(withFacts(draft), shown) : done}
      eyebrow={p.eyebrow ?? `HOUSE-MADE · A PART OF ${p.parent.toUpperCase()}`}
      doneLabel={save ? (save.saving ? 'Saving' : `Done: save ${p.top} with ${shown}`) : (p.doneLabel ?? `Done: ${shown} goes in ${p.parent}`)}
    />
  );
  if (p.frame === 'panel') {
    return (
      <DragScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, styles.panelPage]}>
        {head}
        {body}
      </DragScrollView>
    );
  }
  return (
    <KeyboardScreen testID="part-page">
      {(statusBar) => (
        <DragScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: ds.c.ground }} contentContainerStyle={[styles.page, { paddingTop: statusBar + space.sm, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }]}>
          {head}
          {body}
        </DragScrollView>
      )}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: layout.page.text, alignSelf: 'center', gap: space.md },
  panelPage: { padding: space.xl },
  stack: { gap: space.md },
  panel: { gap: space.md, padding: space.lg, marginBottom: space.md, borderRadius: radius.card, borderWidth: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
