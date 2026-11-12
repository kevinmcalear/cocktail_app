import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, PressableScale, Sheet, SheetScrollView, useDs } from '@/components/ds';
import { FlowHead } from '@/components/ds/FlowHead';
import { ListGroup, ListNote, ListRow } from '@/components/ds/ListGroup';
import { layout, radius, space } from '@/constants/tokens';
import { ALLERGENS, listAllergens, type Allergen } from '@/lib/allergens';
import { allAllergens, guessKind, keepsText, partFacts, PREP_KINDS, prepYield, startPrep, tileOf, type PrepDraft, type PrepKindId } from '@/lib/prepKinds';
import { formatQuantity } from '@/lib/quantity';

import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';

/** The Allergens row's value (board Add-house, 2; Add-parts, 2): what's in it, "None" when set by hand to none, else "None found". */
export function allergensValue(draft: PrepDraft): string {
  const contains = [listAllergens(allAllergens(draft)), ...(draft.contains ?? []).map((c) => c.toLowerCase())].filter(Boolean).join(', ');
  return contains ? contains[0].toUpperCase() + contains.slice(1) : draft.allergensSet ? 'None' : 'None found';
}

/** The Allergens row opened in place: the 14, each a toggle of its own. One a part carries shows on here, and changes in the part. */
export function AllergenToggles({ draft, set }: { draft: PrepDraft; set: (change: Partial<PrepDraft>) => void }) {
  const ds = useDs();
  const allergens = draft.allergens ?? [];
  const fromParts = partFacts(draft).allergens;
  const toggle = (key: Allergen) => set({ allergens: allergens.includes(key) ? allergens.filter((k) => k !== key) : [...allergens, key], allergensSet: true });
  return (
    <View role="group" aria-label="Allergens in it" style={styles.toggles}>
      {ALLERGENS.map((a) => {
        // A part's, and not ticked here too: it changes in the part. One ticked here as well can still be unticked.
        const fixed = fromParts.includes(a.key) && !allergens.includes(a.key);
        const on = fixed || allergens.includes(a.key);
        return (
          <PressableScale
            key={a.key}
            role="checkbox"
            aria-checked={on}
            aria-disabled={fixed}
            disabled={fixed}
            accessibilityLabel={fixed ? `${a.label}, from a part` : a.label}
            onPress={() => toggle(a.key)}
            style={[styles.toggle, { backgroundColor: on ? ds.c.ink : ds.c.raised, borderColor: on ? ds.c.ink : ds.c.line }, fixed ? styles.fixed : null]}
          >
            <Caption color={on ? ds.c.ground : ds.c.ink}>{a.label}</Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

const STORE_WORD: Record<string, string> = { Fridge: 'cold', Freezer: 'frozen' };
// Short enough that a phone's row keeps its title (Method, Keeps) whole beside it.
const short = (s: string) => (s.length > 24 ? `${s.slice(0, 23).trimEnd()}…` : s);

type Row = 'kind' | 'method' | 'makes' | 'keeps';

interface PrepRowsProps {
  name: string;
  draft: PrepDraft;
  set: (change: Partial<PrepDraft>) => void;
  /** Bumped when the draft is replaced (a kind picked): the method's own rows start again from it. */
  version: number;
  phrase: string | null;
  onKind: (kind: PrepKindId, way?: string) => void;
  onTechnique: (id: string) => void;
  bar: { id: string; name: string } | null;
  /** Under its line on the web's dialog (Add-parts, Web): the rows open in place, not as sheets over the dialog. */
  inPlace?: boolean;
  /** A part (Add-parts, 2 and 3, decided 12 Nov): a fifth row, Allergens, opening in place as on Add-house, 2. */
  allergens?: boolean;
}

/**
 * A house-made's flat rows (boards Add-parts 2, Add-inside 2): What it is,
 * Method, Makes and Keeps (and a part's Allergens), each with what it says now, Add in amber while
 * it's empty (Add-inside, Empty: a kind nothing says yet, keeping nobody
 * said). A kind read from the name says so ("Syrup · from the name").
 * Each opens its step as a sheet (Add-inside, 3): Method and
 * Keeps open How it's made (your kit first, the steps, a time in a step a
 * timer, then keeps), What it is the kinds.
 */
export function PrepRows({ name, draft, set, version, phrase, onKind, onTechnique, bar, inPlace, allergens }: PrepRowsProps) {
  const [open, setOpen] = useState<Row | null>(null);
  const [allergensOpen, setAllergensOpen] = useState(false);
  // The sheet keeps what it shows while it slides away.
  const [sheet, setSheet] = useState(false);
  // Tapped here: Something else picked is an answer, not a gap.
  const [picked, setPicked] = useState(false);
  const guess = guessKind(name);
  const fromName = !picked && !!guess && tileOf(guess) === tileOf(draft.kind);
  const unknown = !picked && draft.kind === 'other' && !draft.technique && !guess;
  const kindName = PREP_KINDS.find((k) => k.id === draft.kind)?.name ?? 'Something else';
  const kindValue = unknown ? null : fromName ? `${kindName} · from the name` : kindName;
  const method = draft.steps.length ? short(draft.steps.map((s) => s.body.trim().replace(/\.$/, '')).join(', ')) : null;
  const makes = prepYield(draft);
  // How long it keeps is the answer: where alone, still its kind's own, isn't.
  const kept = keepsText(draft) || draft.storage !== startPrep(draft.kind, name).storage;
  const keeps = kept ? short([keepsText(draft), STORE_WORD[draft.storage] ?? (draft.storage.toLowerCase() || null)].filter(Boolean).join(', ')) || null : null;
  const toggle = (o: Row) => {
    setOpen(inPlace && open === o ? null : o);
    setSheet(!inPlace);
  };

  const kind = (k: PrepKindId, way?: string) => {
    setPicked(true);
    onKind(k, way);
  };
  const technique = (id: string) => {
    setPicked(true);
    onTechnique(id);
  };
  const kinds = <PrepKindStep name={name} draft={draft} combined={false} onKind={kind} onTechnique={technique} bar={bar} only={inPlace ? undefined : 'kind'} />;
  const how = (
    <>
      {inPlace ? null : <PrepKindStep name={name} draft={draft} onKind={kind} onTechnique={technique} bar={bar} only="ways" />}
      <PrepMethodStep key={`method-${version}`} draft={draft} set={set} phrase={phrase} />
    </>
  );
  const makesNote = <ListNote icon="info.circle" text={makes ? 'A guess from the weights. Log your first batch and it uses the real number.' : 'Give the lines amounts and it says about how much it makes.'} />;
  // Keeping is written in the method's step.
  const shown = open === 'kind' ? kinds : open === 'method' || open === 'keeps' ? how : open === 'makes' ? makesNote : null;
  const title = open === 'kind' ? 'What it is' : open === 'makes' ? 'Makes' : 'How it’s made';

  return (
    <>
      <ListGroup>
        <ListRow first title="What it is" value={kindValue ?? 'Add'} warn={!kindValue} expanded={inPlace && open === 'kind'} onPress={() => toggle('kind')} />
        <ListRow title="Method" value={method ?? 'Add'} warn={!method} expanded={inPlace && open === 'method'} onPress={() => toggle('method')} />
        <ListRow title="Makes" value={makes ? `About ${formatQuantity({ kind: 'ml', value: makes, unit: 'ml' })}` : 'Add'} warn={!makes} expanded={inPlace && open === 'makes'} onPress={() => toggle('makes')} />
        <ListRow title="Keeps" value={keeps ?? 'Add'} warn={!keeps} expanded={inPlace && open === 'keeps'} onPress={() => toggle('keeps')} />
        {allergens ? <ListRow title="Allergens" value={allergensValue(draft)} expanded={allergensOpen} onPress={() => setAllergensOpen(!allergensOpen)} /> : null}
      </ListGroup>
      {allergens && allergensOpen ? <AllergenToggles draft={draft} set={set} /> : null}
      {inPlace ? shown : (
        <Sheet visible={sheet} onClose={() => setSheet(false)} accessibilityLabel={title} keyboard header={<FlowHead title={title} done />}>
          <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {shown}
          </SheetScrollView>
        </Sheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fixed: { opacity: 0.6 },
  toggle: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  body: { gap: space.lg, padding: space.xl, paddingTop: space.sm, paddingBottom: space.xxxl },
});
