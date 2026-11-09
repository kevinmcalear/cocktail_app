import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Field, useDs, useGutter } from '@/components/ds';
import { DragScrollView } from '@/components/ds/dragScroll';
import { ListGroup, ListNote, ListRow } from '@/components/ds/ListGroup';
import { layout, radius, space } from '@/constants/tokens';
import { takenPartWords, useSameNamePrep } from '@/hooks/useSameNamePrep';
import { MOST_LEVELS } from '@/lib/houseMadeParts';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { keepsText, PREP_KINDS, prepYield, withFacts, type PrepDraft } from '@/lib/prepKinds';
import { formatQuantity } from '@/lib/quantity';
import { looksMadeInHouse } from '@/lib/techniques/makeIt';

import type { CatalogIngredient } from '../IngredientSearch';
import { Prompt } from '../Prompt';
import { trailInto, type TrailItem } from '../Trail';
import { KeyboardScreen } from '../WizardFrame';
import { PageHead } from './PageHead';
import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';
import { PrepRecipeStep } from './PrepRecipeStep';
import { useInside } from './useInside';
import { usePrepDraft } from './usePrepDraft';

export interface PartPageProps {
  /** The part's name, as its line says it ("Honey-ginger syrup"). */
  name: string;
  /** Its recipe so far, when it has one. */
  initial: PrepDraft | null;
  /** What it's a part of ("Penicillin batch"): the eyebrow says so. */
  parent: string;
  /** The house-made at the top, the page's title. */
  top: string;
  /** The levels above it, from the top: the trail, each a way back up. */
  above: readonly TrailItem[];
  /** 2 for a part, 3 for a part of a part: the most (Add-parts, 3). */
  level: number;
  bar: { id: string; name: string } | null;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  /** On the web's dialog, under its line in place (Add-parts, Web), not a page of its own. */
  inPlace?: boolean;
  /** Each change, on its line as it's made: the draft keeps it, offline too. */
  onKeep: (prep: PrepDraft, name: string) => void;
  /** The check, or Close the part: on its line, back to the level above. */
  onDone: (prep: PrepDraft, name: string) => void;
  /** Back: what's done stays on its line (Back comes here). */
  onClose: () => void;
  /** Its name is taken here, Use yours: the line uses that one. */
  onUse: (id: string, name: string) => void;
}

const STORE_WORD: Record<string, string> = { Fridge: 'cold', Freezer: 'frozen' };
// Short enough that a phone's row keeps its title (Method, Keeps) whole beside it.
const short = (s: string) => (s.length > 24 ? `${s.slice(0, 23).trimEnd()}…` : s);

/**
 * A part made inside a house-made, one flat page (boards Add-parts, 2 and 3;
 * the same page a house-made started inside a drink uses, Add-inside): the
 * trail, its lines and the search, then What it is, Method, Makes and Keeps
 * as rows that open in place. A line that's not one of yours yet can be
 * made here too, one more level in, three levels at most. On the web's
 * dialog it opens under its line instead (Add-parts, Web).
 */
export function PartPage(p: PartPageProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const [name, setName] = useState(p.name);
  const [renaming, setRenaming] = useState(false);
  const [open, setOpen] = useState<'kind' | 'method' | 'makes' | 'keeps' | null>(null);
  const { draft, changed, setDraft, view, pickKind, pickTechnique, phrase, version, named, slotsOpen } = usePrepDraft({ name: p.name, nameNow: name, initial: p.initial, bar: p.bar, measured: true });
  const shown = name.trim() || p.name;
  const inside = useInside(draft, setDraft, shown);
  const trail = trailInto(p.above, p.onClose, shown);
  const last = p.level >= MOST_LEVELS;

  // Android's back: the level showing goes back, one at a time.
  const nested = !!inside.props;
  const onClose = p.onClose;
  useEffect(() => {
    if (p.inPlace || nested) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true));
    return () => sub.remove();
  }, [onClose, p.inPlace, nested]);

  // Board Add-parts, 6: a part named like one you have: Use yours first, or make a new one.
  const same = useSameNamePrep({ barId: p.bar?.id ?? null, name: shown });
  const taken = same.data;
  // What's written goes on its line as it's written, so leaving the whole house-made keeps it. Not while its name is
  // taken (or still being checked): Back then leaves the line as it was, and the save can't fail on it later.
  const free = !taken && !same.checking;
  useEffect(() => {
    if (free && (changed() || name !== p.name)) p.onKeep(withFacts(draft), shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kept when what it keeps changes
  }, [draft, name, free]);
  const words = taken ? takenPartWords(taken, p.bar?.name ?? null) : null;
  // A line that isn't one of yours yet and sounds made (Add-parts, 2: "To make").
  const toMake = last ? undefined : draft.lines.find((l) => !l.id && !l.prep && !l.slot && !l.bottle && l.name.trim() && looksMadeInHouse(l.name));
  const done = () => p.onDone(withFacts(draft), shown);
  const canDone = named && !slotsOpen && !!shown.trim() && !taken;

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
      onKeep={inside.keep}
      onDone={inside.props.onDone}
      onClose={inside.props.onClose}
      onUse={inside.use}
    />
  ) : null);
  // A phone goes one level in as a page of its own.
  if (!p.inPlace && inside.props) return below(p.level + 1, false);

  const kindName = PREP_KINDS.find((k) => k.id === draft.kind)?.name ?? 'Something else';
  const method = draft.steps.length ? short(draft.steps.map((s) => s.body.trim().replace(/\.$/, '')).join(', ')) : null;
  const makes = prepYield(draft);
  const keeps = short([keepsText(draft), STORE_WORD[draft.storage] ?? (draft.storage.toLowerCase() || null)].filter(Boolean).join(', ')) || null;
  const toggle = (o: typeof open) => setOpen(open === o ? null : o);

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
      <ListGroup>
        <ListRow first title="What it is" value={kindName} expanded={open === 'kind'} onPress={() => toggle('kind')} />
        <ListRow title="Method" value={method ?? 'Add'} warn={!method} expanded={open === 'method'} onPress={() => toggle('method')} />
        <ListRow title="Makes" value={makes ? `About ${formatQuantity({ kind: 'ml', value: makes, unit: 'ml' })}` : 'Add'} warn={!makes} expanded={open === 'makes'} onPress={() => toggle('makes')} />
        <ListRow title="Keeps" value={keeps ?? 'Add'} warn={!keeps} expanded={open === 'keeps'} onPress={() => toggle('keeps')} />
      </ListGroup>
      {open === 'kind' ? <PrepKindStep name={shown} draft={draft} combined={false} onKind={pickKind} onTechnique={pickTechnique} bar={p.bar} /> : null}
      {open === 'method' || open === 'keeps' ? <PrepMethodStep key={`method-${version}`} draft={draft} set={(c) => setDraft({ ...draft, ...c })} phrase={phrase} /> : null}
      {open === 'makes' ? <ListNote icon="info.circle" text={makes ? 'A guess from the weights. Log your first batch and it uses the real number.' : 'Give the lines amounts and it says about how much it makes.'} /> : null}
    </View>
  );

  if (p.inPlace) {
    return (
      <View role="group" aria-label={`${shown}, a part of ${p.parent}`} style={[styles.panel, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
        <Body>{`${shown} · a part, opened under its line`}</Body>
        <Caption tone="muted">{`Its lines, the same as a page of its own.${toMake ? ` ${toMake.name} opens one more level in, here.` : ''}`}</Caption>
        {body}
        <View style={styles.buttons}>
          {toMake ? <Button label={`Make ${toMake.name} here`} onPress={() => inside.open(toMake.key)} /> : null}
          <Button label="Close the part" variant={toMake ? 'secondary' : 'primary'} disabled={!canDone} onPress={done} />
        </View>
      </View>
    );
  }
  return (
    <KeyboardScreen testID="part-page">
      {(statusBar) => (
        <DragScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: ds.c.ground }} contentContainerStyle={[styles.page, { paddingTop: statusBar + space.sm, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }]}>
          <PageHead trail={trail} drinkName={p.top} name={shown} canAdd={canDone} onBack={p.onClose} onDone={done} eyebrow={`HOUSE-MADE · A PART OF ${p.parent.toUpperCase()}`} doneLabel={`Done: ${shown} goes in ${p.parent}`} />
          {body}
        </DragScrollView>
      )}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: layout.page.text, alignSelf: 'center', gap: space.md },
  stack: { gap: space.md },
  panel: { gap: space.md, padding: space.lg, marginBottom: space.md, borderRadius: radius.card, borderWidth: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
