import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Display, GlassButton, Headline, Tag, Title, useBreakpoint, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useAddRankEntry, useRecordComparisons, type RankEntry, type RankVenue } from '@/hooks/useRankings';
import { heroPicture, type ItemPicture } from '@/lib/itemImages';
import { comparedWith, dayOf, formatScore, localDate, nextPlacement, plural, rankKeyAt, rankScore, SENTIMENTS, type Answer, type Sentiment } from '@/lib/ranking';

import { SentimentPicker, sentimentLabel, VsCard, WherePicker, type VsSide } from './RankParts';

export interface RankSheetProps {
  onClose: () => void;
  onSeeRankings: () => void;
  drink: { id: string; name: string; picture: ItemPicture | null };
  /** The list it's compared in ("Martini"). */
  rankedAs: { id: string; name: string };
  /** The drink's own bar, if it has a public profile. */
  ownBar: RankVenue | null;
  /** My list for rankedAs, best first. Undefined while it loads. */
  list: RankEntry[] | undefined;
  listFailed?: boolean;
}

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long' });

function whereLabel(venue: { display_name: string } | null): string {
  return venue ? venue.display_name : 'Home';
}

/**
 * Rank a drink by comparison: "How was it?", then "Which was better?" against
 * my others in the same band until it's placed, then its score. Saves once, at
 * the end, so closing half way leaves nothing behind.
 */
export function RankSheet({ onClose, onSeeRankings, drink, rankedAs, ownBar, list, listFailed }: RankSheetProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'phone';
  const addEntry = useAddRankEntry();
  const record = useRecordComparisons();
  // undefined: not chosen yet, so the drink's own bar (or home).
  const [chosenVenue, setChosenVenue] = useState<RankVenue | null | undefined>(undefined);
  const venue = chosenVenue === undefined ? ownBar : chosenVenue;
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; position: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = addEntry.isPending || record.isPending;
  // A quick double tap on the last answer must not save twice.
  const busy = useRef(false);

  // Ranked here before: this replaces it, so it isn't compared with itself.
  const existing = list?.find((e) => e.item_id === drink.id && e.venue_profile_id === (venue?.id ?? null));
  const others = (list ?? []).filter((e) => e.id !== existing?.id && e.id !== savedId);
  const bandOf = (s: Sentiment) => others.filter((e) => e.sentiment === s);

  const save = async (s: Sentiment, given: Answer[]) => {
    const band = bandOf(s);
    const placed = nextPlacement(band.length, given);
    if (!placed.done || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      let id = savedId;
      if (!id) {
        const row = await addEntry.mutateAsync({
          ...(existing ? { id: existing.id } : {}),
          item_id: drink.id,
          ranked_as_item_id: rankedAs.id,
          venue_profile_id: venue?.id ?? null,
          sentiment: s,
          rank_key: rankKeyAt(band.map((e) => e.rank_key), placed.index),
          had_on: localDate(),
        });
        id = row.id;
        setSavedId(id);
      }
      const against = comparedWith(band.length, given);
      await record.mutateAsync(
        given.map((a, i) => {
          const old = band[against[i]].id;
          return a === 'new' ? { winner_entry_id: id!, loser_entry_id: old, is_tie: false } : { winner_entry_id: old, loser_entry_id: id!, is_tie: a === 'tie' };
        })
      );
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const better = others.filter((e) => SENTIMENTS.indexOf(e.sentiment) < SENTIMENTS.indexOf(s)).length;
      setResult({ score: rankScore(s, placed.index, band.length + 1), position: better + placed.index + 1, total: others.length + 1 });
    } catch (e) {
      setError(e instanceof Error ? `Couldn't save your ranking: ${e.message}` : "Couldn't save your ranking.");
    } finally {
      busy.current = false;
    }
  };

  const pick = (s: Sentiment) => {
    setSentiment(s);
    setAnswers([]);
    void save(s, []);
  };
  const answer = (a: Answer) => {
    const next = [...answers, a];
    setAnswers(next);
    void save(sentiment!, next);
  };

  const band = sentiment ? bandOf(sentiment) : [];
  const placement = sentiment ? nextPlacement(band.length, answers) : null;
  const comparing = placement && !placement.done ? placement : null;
  const here = `${drink.name} at ${whereLabel(venue)}`;

  const compareWith = (entry: RankEntry): VsSide => {
    const picture = heroPicture(entry.item?.item_images);
    const name = entry.item?.name && entry.item.name !== rankedAs.name ? `${entry.item.name}, ` : '';
    const when = entry.had_on ?? entry.created_at;
    return {
      title: `Your #${others.indexOf(entry) + 1} ${rankedAs.name}`,
      name: entry.item?.name ?? rankedAs.name,
      detail: `${name}${whereLabel(entry.venue)} · ${MONTH.format(dayOf(when))}`,
      picture,
    };
  };

  let body: ReactNode;
  if (result) {
    body = (
      <>
        <Caption tone="muted">{here}</Caption>
        <Caption tone="muted">Your score</Caption>
        <Display accessibilityLabel={`Your score: ${formatScore(result.score)} out of 10`}>{formatScore(result.score)}</Display>
        <Tag label={sentimentLabel(sentiment!)} />
        <Body>{`Your #${result.position} of ${result.total} ${plural(rankedAs.name)}.`}</Body>
        <View style={styles.actions}>
          <Button label={`See ${plural(rankedAs.name)}`} variant="secondary" onPress={onSeeRankings} />
          <Button label="Done" onPress={onClose} />
        </View>
      </>
    );
  } else if (comparing) {
    const cardHeight = wide ? 200 : 150;
    body = (
      <>
        <Caption tone="muted">{`${comparing.remaining} more to place it`}</Caption>
        <Caption tone="muted">You just had</Caption>
        <Headline>{here}</Headline>
        <Title>Which was better?</Title>
        <View style={[styles.vs, wide && styles.vsRow]}>
          <View style={wide ? styles.flex : undefined}>
            <VsCard side={{ title: 'This one', name: drink.name, detail: `${whereLabel(venue)} · today`, picture: drink.picture }} height={cardHeight} onPress={() => answer('new')} />
          </View>
          <Body tone="muted" align="center">
            or
          </Body>
          <View style={wide ? styles.flex : undefined}>
            <VsCard side={compareWith(band[comparing.against])} height={cardHeight} onPress={() => answer('old')} />
          </View>
        </View>
        <Button label="Too close to call" variant="secondary" onPress={() => answer('tie')} />
      </>
    );
  } else if (sentiment) {
    body = (
      <>
        <Caption tone="muted">You just had</Caption>
        <Headline>{here}</Headline>
        <Title>{error ? 'Not saved yet' : 'Placing it…'}</Title>
      </>
    );
  } else {
    body = (
      <>
        <Caption tone="muted">You just had</Caption>
        <Headline>{drink.name}</Headline>
        <WherePicker ownBar={ownBar} value={venue} onChange={setChosenVenue} />
        {existing ? <Caption tone="muted">{`You ranked this ${formatScore(existing.score)} before. Ranking it again replaces that.`}</Caption> : null}
        <Title>How was it?</Title>
        {list ? (
          <SentimentPicker onPick={pick} />
        ) : (
          <Body tone="muted">{listFailed ? "Couldn't load your list, so there's nothing to compare with yet. Close this and try again." : 'Loading your list…'}</Body>
        )}
      </>
    );
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
        <Pressable role="dialog" aria-label={`Rank ${drink.name}`} style={[styles.sheet, { backgroundColor: ds.c.surface }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
            <View style={styles.close}>
              <GlassButton accessibilityLabel="Close" icon="xmark" onPress={onClose} />
            </View>
            {body}
            {saving ? <Caption tone="muted">Saving…</Caption> : null}
            {error ? (
              <View style={styles.actions}>
                <Caption tone="accent">{error}</Caption>
                <Button label="Try again" variant="secondary" onPress={() => void save(sentiment!, answers)} />
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '92%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous' },
  body: { padding: space.xl, gap: space.md },
  close: { alignSelf: 'flex-end', marginBottom: -space.xxl },
  vs: { gap: space.sm },
  vsRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flexGrow: 1, flexBasis: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm, marginTop: space.sm },
});
