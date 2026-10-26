import { StyleSheet, View } from 'react-native';

import { Body, Caption, Surface, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import type { SameNameDrink } from '@/hooks/useSameNameDrink';
import type { ClassicMatch } from '@/lib/classics';
import { withArticle } from '@/lib/closestClassic';
import type { WizardDraft } from '@/lib/drinkWizard';
import { sameName, theirs, versionName } from '@/lib/sameName';

import { StartPhotos } from './ReviewPhotos';
import { NearNameCard } from './NearNameCard';
import { BracketField, SameNameCard, useSameNamePicks } from './SameNameCard';
import { StartFromClassic } from './StartFromClassic';
import { NameStep } from './TextSteps';

interface Props {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  barId: string | null;
  /** The venue's name ("Little Rye"). */
  venueName: string;
  /** The venue's drink with this name, or at home your own (useSameNameDrink). */
  match: SameNameDrink | null;
  classic: ClassicMatch | null;
  resumed: boolean;
  onStartOver: () => void;
  onDone: () => void;
  /** After a pick that fills the spec in: on to the ingredients. */
  onStarted: () => void;
}

/**
 * The add-drink wizard's first step: the name, photos, and the classic it
 * may be. When the bar already has a drink by that name (board
 * dup-drink-warning), or at home you do (Q14b), its card instead, then a version's word in brackets
 * or a reminder to name a different drink apart.
 */
export function NameStepBody({ draft, set, barId, venueName, match, classic, resumed, onStartOver, onDone, onStarted }: Props) {
  const picks = useSameNamePicks(set);
  const same = draft.sameAs ?? null;
  if (same?.as === 'version') return <VersionWord draft={draft} taken={!!match && match.id !== same.id} onWord={(w) => picks.word(draft, w)} onUndo={() => picks.undo(draft)} />;

  const asking = !!match && same?.id !== match.id;
  // At home the drink is your own: "You already have a Negroni".
  const bar = barId ? venueName : '';
  const apart = same?.as === 'different' ? !sameName(draft.name, same.name) : null;
  return (
    <>
      <NameStep draft={draft} set={set} onDone={onDone} resumed={resumed} onStartOver={onStartOver} />
      {same && apart !== null ? <ApartHint done={apart} words={`Give it a name that tells it apart from ${theirs(same.bar, same.name)}.`} /> : null}
      {match && asking ? (
        <SameNameCard
          bar={bar}
          drink={match}
          caption={`A version is the same drink with a different spec${bar ? '' : `, like ${match.name} (less bitter)`}.`}
          busy={picks.busy}
          onOpen={() => picks.open(match)}
          onVersion={() => picks.version(match, bar, true)}
          onDifferent={() => picks.different(match, bar)}
        />
      ) : null}
      <NearNameCard draft={draft} set={set} barId={barId} venueName={venueName} hidden={!!match || !!classic} onStarted={onStarted} />
      <StartPhotos photos={draft.photos ?? {}} onChange={(photos) => set({ photos })} barId={barId} />
      {/* The bar's drink is already linked to the classic: its card comes back once the name is the bar's no more. */}
      {classic && !asking && apart !== false ? <StartFromClassic set={set} match={classic} onStarted={onStarted} /> : null}
    </>
  );
}

/** "Give it a name that tells it apart", ticked once it does. */
export function ApartHint({ done, words }: { done: boolean; words: string }) {
  const ds = useDs();
  return (
    <View style={styles.hint}>
      {done ? <IconSymbol name="checkmark" size={14} color={ds.c.muted} /> : null}
      <Caption tone="muted" style={styles.flex}>
        {words}
      </Caption>
    </View>
  );
}

/** Make this a version: the word in brackets, where it starts from, and where it's saved. */
function VersionWord({ draft, taken, onWord, onUndo }: { draft: WizardDraft; taken: boolean; onWord: (word: string) => void; onUndo: () => void }) {
  const same = draft.sameAs!;
  const word = same.word ?? '';
  return (
    <View style={styles.stack}>
      <View style={styles.field}>
        <Caption tone="muted">A word or two, in brackets after the name</Caption>
        <BracketField name={same.name} value={word} onChange={onWord} label={`What’s different about this ${same.name}`} autoFocus={!word} />
        {taken ? <TakenWord bar={same.bar} name={draft.name} /> : null}
      </View>
      <Surface raised style={styles.card}>
        {same.started ? <Body>{`It starts from ${theirs(same.bar, 'spec')}: ${same.started}. Change what’s different on the next steps.`}</Body> : null}
        <Caption tone="muted">{`Saved as ${versionName(same.name, word.trim() || '…')}, next to ${theirs(same.bar, same.name)}.`}</Caption>
      </Surface>
      <View style={styles.undo}>
        <TextLink label="Not a version" tone="ink" onPress={onUndo} />
      </View>
    </View>
  );
}

/** The word makes a name the bar has too ("Negroni (summer)" is there already): Next waits for another. */
export function TakenWord({ bar, name }: { bar: string; name: string }) {
  return <Caption tone="accent">{`${bar ? `${bar} already has` : 'You already have'} ${withArticle(name.trim())}. Try another word.`}</Caption>;
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  field: { gap: space.sm },
  card: { gap: space.sm },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  flex: { flex: 1 },
  undo: { alignSelf: 'flex-start' },
});
