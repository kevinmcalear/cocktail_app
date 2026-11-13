import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkDrawingFor, DsText, Tag, Title, useDs } from '@/components/ds';
import { AgeGateSheet } from '@/components/screens/safety/AgeGateSheetLazy';
import { displayFaces, drawing, radius, space } from '@/constants/tokens';
import type { FirstRunDrink } from '@/hooks/useFirstRunDrinks';
import { useAgeCheck } from '@/hooks/useAgeCheck';
import { useSaveSwipes, useWantDeck, type DeckDrink } from '@/hooks/useWantDeck';
import { withAlpha } from '@/lib/color';
import { SWIPES, tasteFrom } from '@/lib/firstRun';
import { matchPercent, type Profile, type Taste } from '@/lib/flavor';

import { FirstRunPage } from './FirstRunPage';
import { SwipeDrag } from './SwipeDrag';

/** The board's card drawing, 260, from the 280 hero drawing. */
const ART = 260;

type Answer = { id: string; want: boolean; profile: Profile | null };

/**
 * The ten swipes after the pairs (board Loop-want, "In onboarding"; note
 * loops-n4): drinks they haven't picked, each Want or Not for me. Each answer
 * keeps its drink's flavours, so the Wants count in the taste whatever the
 * deck does after. At the tenth, the passes save (drink_passes); the Wants
 * (want_list) need a confirmed age like all collecting, so with none yet the
 * age check asks first, and Wants it doesn't confirm are not saved. Then
 * `onDone` with the Wants' flavours. With nothing to swipe it goes straight on.
 */
export function SwipesStep({ picks, winners, onBack, onDone }: { picks: readonly FirstRunDrink[]; winners: readonly string[]; onBack: () => void; onDone: (wanted: (Profile | null)[]) => void }) {
  const deck = useWantDeck(SWIPES, picks.map((p) => p.id));
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [asking, setAsking] = useState<Answer[] | null>(null);
  const save = useSaveSwipes();
  const age = useAgeCheck().data;
  const wantedOf = (list: Answer[]) => list.filter((a) => a.want).map((a) => a.profile);

  const finish = (list: Answer[]) => {
    const wants = list.filter((a) => a.want).map((a) => a.id);
    const passes = list.filter((a) => !a.want).map((a) => a.id);
    if (passes.length) save.mutate({ wants: [], passes });
    if (!wants.length) return onDone(wantedOf(list));
    if (age === 'confirmed') {
      save.mutate({ wants, passes: [] });
      return onDone(wantedOf(list));
    }
    setAsking(list);
  };
  const at = answers.length;
  const card = deck.drinks[at];
  const back = () => (at ? setAnswers((a) => a.slice(0, -1)) : onBack());
  const answer = (want: boolean) => {
    if (!card) return;
    const next = [...answers, { id: card.id, want, profile: card.profile }];
    setAnswers(next);
    if (next.length >= deck.drinks.length) finish(next);
  };

  // Nothing to swipe (every classic answered, or the deck didn't load): straight on to Your taste.
  const empty = !!deck.error || (deck.ready && !deck.drinks.length);
  useEffect(() => {
    if (empty) onDone([]);
  }, [empty, onDone]);
  if (empty) return null;
  return (
    <FirstRunPage onBack={back} barTitle={`${Math.min(at + 1, deck.drinks.length || SWIPES)} of ${deck.drinks.length || SWIPES}`}>
      {card ? <SwipeCard key={card.id} drink={card} taste={tasteFrom(picks, winners, wantedOf(answers))} onAnswer={answer} /> : <Caption tone="muted">One moment…</Caption>}
      {asking ? (
        <AgeGateSheet
          onClose={() => (setAsking(null), onDone(wantedOf(asking)))}
          onConfirmed={() => {
            save.mutate({ wants: asking.filter((a) => a.want).map((a) => a.id), passes: [] });
            setAsking(null);
            onDone(wantedOf(asking));
          }}
        />
      ) : null}
    </FirstRunPage>
  );
}

/**
 * One of the ten (board Loop-want, phone 3): the drink on its colour with a
 * card behind it, its match top right, its name and what's in it; Not for me
 * and Want under it, which do what a swipe does, and the hint.
 */
export function SwipeCard({ drink, taste, onAnswer }: { drink: DeckDrink; taste: Taste; onAnswer: (want: boolean) => void }) {
  const ds = useDs();
  const match = drink.profile ? matchPercent(taste, drink.profile) : null;
  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={[styles.behind, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]} />
        <SwipeDrag
          onSwipe={onAnswer}
          label={`${drink.name}${match !== null ? `, ${match}% match` : ''}`}
          tag={<Tag label="Want" tone="success" style={styles.tag} />}
          style={[styles.card, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]}
        >
          {/* Its colour over the paper, so the card behind doesn't show through. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: drink.tint ? withAlpha(drink.tint, ds.scheme === 'dark' ? 0.28 : 0.2) : ds.c.surface }]} />
          <View style={styles.art}>
            <View style={{ transform: [{ scale: ART / drawing.hero }] }}>
              <DrinkDrawingFor itemId={drink.id} size="hero" pour={false} />
            </View>
          </View>
          {match !== null ? (
            <DsText variant="label" style={styles.match}>
              {`${match}% match`}
            </DsText>
          ) : null}
          <View style={styles.text}>
            <Title numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
              {drink.name}
            </Title>
            {drink.ingredients ? (
              <Body tone="muted" numberOfLines={2}>
                {drink.ingredients}
              </Body>
            ) : null}
          </View>
        </SwipeDrag>
      </View>
      <View style={styles.buttons}>
        <Button label="Not for me" variant="secondary" onPress={() => onAnswer(false)} style={styles.flex} />
        <Button label="Want" variant="ink" onPress={() => onAnswer(true)} style={styles.flex} />
      </View>
      <Caption tone="muted" align="center">
        Swipe right for Want, left for Not for me.
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  // The board: the card 420 tall over one 410 tall, inset 14, in a 430 block.
  stage: { height: 430 },
  behind: { position: 'absolute', left: 14, right: 14, top: 14, height: 410, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  card: { height: 420, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  art: { position: 'absolute', left: 0, right: 0, top: 34, height: ART, alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', left: 22, top: 22 },
  match: { position: 'absolute', right: 20, top: 22, textAlign: 'right' },
  text: { position: 'absolute', left: 22, right: 22, bottom: 22, gap: space.xs },
  buttons: { flexDirection: 'row', gap: space.sm + 2, paddingTop: space.sm + 2 },
  flex: { flex: 1 },
});
