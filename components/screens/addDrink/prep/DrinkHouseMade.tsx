import { useNetInfo } from '@react-native-community/netinfo';
import { use, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useDs } from '@/components/ds';
import { ListNote } from '@/components/ds/ListGroup';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { PrepDraft, PrepPick } from '@/lib/prepKinds';

import type { CatalogIngredient } from '../IngredientSearch';
import { Prompt } from '../Prompt';
import type { TrailItem } from '../Trail';
import { IntoSidePanel } from './IntoSidePanel';
import { LeaveCard } from './LeaveCard';
import { PartPage } from './PartPage';
import { SIDE_PANEL_ID, SidePanelContext } from './sidePanel';

export interface DrinkHouseMadeProps {
  /** Its name, as the drink's line says it ("Pine syrup"). */
  name: string;
  /** Its recipe so far, when it has one. */
  initial: PrepDraft | null;
  /** The drink it goes in ("Pine Old Fashioned"), or the house-made being edited. */
  drinkName: string;
  /** In a drink (the eyebrow and the notes say so), or in another house-made's recipe (a part). */
  forDrink: boolean;
  /** A new drink, kept as a draft: New lists it under Pick up where you left off, with the way back. */
  drafts: boolean;
  /** Where the drink is, down to it: the trail. */
  above: readonly TrailItem[];
  bar: { id: string; name: string } | null;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  picked?: { base?: PrepPick | null; adjunct?: PrepPick | null };
  technique?: string | null;
  combined?: boolean;
  /** Its recipe was done before (opened again from its line): Back just closes, what's changed kept. */
  finished?: boolean;
  /** Each change, on the drink's line as it's written (the drink's draft keeps it, offline too). */
  onKeep: (prep: PrepDraft, name: string, done: boolean) => void;
  /** Done: on the line, finished. */
  onDone: (prep: PrepDraft, name: string) => void;
  /** Gone: left for now (what's kept stays on the line), or opened and nothing written. */
  onClose: (kept: boolean) => void;
  /** Its name is taken, Use yours: the line uses that one. */
  onUse: (id: string, name: string) => void;
  /** The drink's check (Add-inside, Saving with the drink): finished on the line, and the drink saves with it. */
  save?: { onSave: (prep: PrepDraft, name: string) => void; saving: boolean; canSave: boolean };
  /** Don't keep it, on Leave it for now?: the line goes back to how it was (the bottle a Make it house started from). */
  onDrop?: () => void;
}

/**
 * A house-made written inside the drink (board Add-inside): one flat page,
 * b2's part page at the top level, over the drink on a phone and beside it
 * on the web's desktop page. It has no save of its own: each change goes on
 * the drink's line, and it saves with the drink. Back before it's done asks
 * "Leave it for now?": the drink shows it as Recipe to finish.
 */
export function DrinkHouseMade(p: DrinkHouseMadeProps) {
  const ds = useDs();
  const panel = use(SidePanelContext);
  const offline = useNetInfo().isConnected === false;
  // Something written here (a change kept on the line): leaving asks first, and says it's kept.
  const [kept, setKept] = useState(false);
  const [asking, setAsking] = useState(false);
  const back = useRef<(() => void) | null>(null);
  const close = () => p.onClose(kept);
  const ask = () => (kept && !p.finished ? setAsking(true) : close());
  const drink = p.drinkName || 'The drink';
  const note = offline ? (
    <Prompt warn icon="exclamationmark.triangle" title="You’re offline." body={`It’s kept in the ${p.forDrink ? 'drink' : 'recipe'}’s draft on this phone; nothing is lost.`} />
  ) : (
    <ListNote icon="flask" text={`Saves with ${p.forDrink ? 'the drink' : drink}. It shows on House-made too.`} />
  );

  const page = (
    <PartPage
      name={p.name}
      initial={p.initial}
      parent={drink}
      top={drink}
      above={p.above}
      level={1}
      bar={p.bar}
      ingredients={p.ingredients}
      aliases={p.aliases}
      picked={p.picked}
      technique={p.technique}
      combined={p.combined}
      frame={panel ? 'panel' : 'page'}
      backRef={back}
      eyebrow={p.forDrink ? 'HOUSE-MADE · DRAFT, INSIDE THE DRINK' : undefined}
      doneLabel={`Done: ${p.name} goes in ${drink}`}
      note={note}
      empty={`Nothing in it yet. Add what goes in, or come back to it: ${p.forDrink ? 'the drink' : drink} shows Recipe to finish.`}
      onKeep={(prep, name, done) => {
        setKept(true);
        p.onKeep(prep, name, done);
      }}
      onDone={p.onDone}
      onClose={close}
      onBack={ask}
      save={p.save}
      onUse={p.onUse}
    />
  );
  // Board Add-inside, Back before it's done.
  const leave = asking ? (
    <LeaveCard
      drink={drink}
      body={`What you’ve done is kept. ${drink} shows it as Recipe to finish${p.drafts ? ', and New lists the drink under Pick up where you left off, with the way back' : ''}.`}
      onLeave={close}
      onStay={() => setAsking(false)}
      onDrop={p.onDrop}
    />
  ) : null;

  if (panel) {
    return (
      <IntoSidePanel host={panel}>
        <View nativeID={SIDE_PANEL_ID} role="region" aria-label={`House-made: ${p.name}`} style={[styles.flex, { backgroundColor: ds.c.ground }]}>
          {page}
          {leave}
        </View>
      </IntoSidePanel>
    );
  }
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => (asking ? setAsking(false) : back.current?.())}>
      {/* Android: gestures in a Modal need their own root (the lines drag). */}
      <GestureHandlerRootView style={[styles.flex, { backgroundColor: ds.c.ground }]}>
        {page}
        {leave}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
