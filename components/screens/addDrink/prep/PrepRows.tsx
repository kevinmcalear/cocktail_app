import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Sheet, SheetScrollView } from '@/components/ds';
import { FlowHead } from '@/components/ds/FlowHead';
import { ListGroup, ListNote, ListRow } from '@/components/ds/ListGroup';
import { space } from '@/constants/tokens';
import { keepsText, PREP_KINDS, prepYield, type PrepDraft, type PrepKindId } from '@/lib/prepKinds';
import { formatQuantity } from '@/lib/quantity';

import { PrepKindStep } from './PrepKindStep';
import { PrepMethodStep } from './PrepMethodStep';

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
}

/**
 * A house-made's flat rows (boards Add-parts 2, Add-inside 2): What it is,
 * Method, Makes and Keeps, each with what it says now, Add in amber while
 * it's empty. Each opens its step as a sheet (Add-inside, 3): Method and
 * Keeps open How it's made (your kit first, the steps, a time in a step a
 * timer, then keeps), What it is the kinds.
 */
export function PrepRows({ name, draft, set, version, phrase, onKind, onTechnique, bar, inPlace }: PrepRowsProps) {
  const [open, setOpen] = useState<Row | null>(null);
  // The sheet keeps what it shows while it slides away.
  const [sheet, setSheet] = useState(false);
  const kindName = PREP_KINDS.find((k) => k.id === draft.kind)?.name ?? 'Something else';
  const method = draft.steps.length ? short(draft.steps.map((s) => s.body.trim().replace(/\.$/, '')).join(', ')) : null;
  const makes = prepYield(draft);
  const keeps = short([keepsText(draft), STORE_WORD[draft.storage] ?? (draft.storage.toLowerCase() || null)].filter(Boolean).join(', ')) || null;
  const toggle = (o: Row) => {
    setOpen(inPlace && open === o ? null : o);
    setSheet(!inPlace);
  };

  const kinds = <PrepKindStep name={name} draft={draft} combined={false} onKind={onKind} onTechnique={onTechnique} bar={bar} only={inPlace ? undefined : 'kind'} />;
  const how = (
    <>
      {inPlace ? null : <PrepKindStep name={name} draft={draft} onKind={onKind} onTechnique={onTechnique} bar={bar} only="ways" />}
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
        <ListRow first title="What it is" value={kindName} expanded={inPlace && open === 'kind'} onPress={() => toggle('kind')} />
        <ListRow title="Method" value={method ?? 'Add'} warn={!method} expanded={inPlace && open === 'method'} onPress={() => toggle('method')} />
        <ListRow title="Makes" value={makes ? `About ${formatQuantity({ kind: 'ml', value: makes, unit: 'ml' })}` : 'Add'} warn={!makes} expanded={inPlace && open === 'makes'} onPress={() => toggle('makes')} />
        <ListRow title="Keeps" value={keeps ?? 'Add'} warn={!keeps} expanded={inPlace && open === 'keeps'} onPress={() => toggle('keeps')} />
      </ListGroup>
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
  body: { gap: space.lg, padding: space.xl, paddingTop: space.sm, paddingBottom: space.xxxl },
});
