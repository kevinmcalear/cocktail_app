import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, GlassButton, PressableScale, Sheet, SheetScrollView, Title, useBreakpoint, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import { useAddRankEntry, useRecordComparisons, type RankEntry, type RankVenue } from '@/hooks/useRankings';
import { heroPicture, type ItemPicture } from '@/lib/itemImages';
import { monthHad, stepCount } from '@/lib/rankResult';
import { comparedWith, formatScore, localDate, nextPlacement, plural, rankKeyAt, type Answer, type Sentiment } from '@/lib/ranking';

import { Pair, SentimentButtons, tick, type PairSide } from './RankParts';
import { RankResult, type Landed } from './RankResult';
import { WhereLine } from './RankWhere';

export interface RankSheetProps {
  onClose: () => void;
  drink: { id: string; name: string; picture: ItemPicture | null };
  /** The list it's compared in ("Negroni"). */
  rankedAs: { id: string; name: string };
  /** Where it was had: the drink's own bar or the bar picked on Rank it, else home. */
  venue: RankVenue | null;
  /** My list for rankedAs, best first. Undefined while it loads. */
  list: RankEntry[] | undefined;
  listFailed?: boolean;
}

/**
 * Rank it (Prod-rank-A, decided 31 Oct): how was it, then this or that
 * against your others of the same kind until it's placed, then where it
 * landed with its neighbours and the optional reasons (RankResult). A tick of
 * haptics on each pick. The system's sheet on phones (kind="flow"), a centred
 * dialog on the web. Saves once it's placed, so closing half way leaves nothing.
 */
export function RankSheet({ onClose, drink, rankedAs, venue, list, listFailed }: RankSheetProps) {
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'phone';
  const addEntry = useAddRankEntry();
  const record = useRecordComparisons();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<RankVenue | null>(venue);
  const saving = addEntry.isPending || record.isPending;
  // A quick double tap on the last answer must not save twice.
  const busy = useRef(false);
  // Saved but its comparisons failed: Try again updates that row, not a second one.
  const [savedId, setSavedId] = useState<string | null>(null);

  // Ranked here before: this replaces it, so it isn't compared with itself.
  const existing = list?.find((e) => e.item_id === drink.id && e.venue_profile_id === (place?.id ?? null));
  const others = (list ?? []).filter((e) => e.id !== existing?.id && e.id !== savedId && e.id !== landed?.entryId);
  const bandOf = (s: Sentiment) => others.filter((e) => e.sentiment === s);
  const where = place?.display_name ?? 'Home';

  const save = async (s: Sentiment, given: Answer[]) => {
    const band = bandOf(s);
    const placed = nextPlacement(band.length, given);
    if (!placed.done || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const id = savedId ?? existing?.id;
      const row = await addEntry.mutateAsync({
        ...(id ? { id } : {}),
        item_id: drink.id,
        ranked_as_item_id: rankedAs.id,
        venue_profile_id: place?.id ?? null,
        sentiment: s,
        rank_key: rankKeyAt(band.map((e) => e.rank_key), placed.index),
        had_on: localDate(),
      });
      setSavedId(row.id);
      const against = comparedWith(band.length, given);
      await record.mutateAsync(
        given.map((a, i) => {
          const old = band[against[i]].id;
          return a === 'new' ? { winner_entry_id: row.id, loser_entry_id: old, is_tie: false } : { winner_entry_id: old, loser_entry_id: row.id, is_tie: a === 'tie' };
        })
      );
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLanded({ entryId: row.id, sentiment: s, index: placed.index });
    } catch (e) {
      setError(e instanceof Error ? `Couldn't save your ranking: ${e.message}` : "Couldn't save your ranking.");
    } finally {
      busy.current = false;
    }
  };

  const pick = (s: Sentiment) => {
    tick();
    setSentiment(s);
    setAnswers([]);
    void save(s, []);
  };
  const answer = (a: Answer) => {
    tick();
    const next = [...answers, a];
    setAnswers(next);
    void save(sentiment!, next);
  };

  const band = sentiment ? bandOf(sentiment) : [];
  const placement = sentiment && !landed ? nextPlacement(band.length, answers) : null;
  const comparing = placement && !placement.done ? placement : null;

  const sideOf = (entry: RankEntry): PairSide => {
    const other = entry.item?.name && entry.item.name !== rankedAs.name ? `${entry.item.name} · ` : `${rankedAs.name} · `;
    return { when: `In ${monthHad(entry)}`, where: entry.venue?.display_name ?? 'Home', sub: `${other}your ${formatScore(entry.score)}`, picture: heroPicture(entry.item?.item_images), itemId: entry.item_id };
  };

  let body: ReactNode;
  let title = '';
  if (landed) {
    body = <RankResult landed={landed} drink={drink} rankedAs={rankedAs} venue={place} others={others} />;
  } else if (comparing) {
    title = stepCount(answers.length, comparing.remaining);
    body = (
      <>
        <View style={styles.center}>
          <Title align="center">Which was better?</Title>
          <Body tone="muted" align="center">{`Only ${plural(rankedAs.name)}, so it stays fair.`}</Body>
        </View>
        <Pair
          left={{ when: 'Tonight', where, sub: drink.name, picture: drink.picture, itemId: drink.id }}
          right={sideOf(band[comparing.against])}
          height={wide ? 360 : 330}
          onPick={answer}
        />
      </>
    );
  } else {
    body = (
      <>
        <View style={styles.center}>
          <Title align="center">{`How was the ${drink.name}?`}</Title>
          {sentiment ? <Body tone="muted" align="center">{`${where} · tonight`}</Body> : <WhereLine ownBar={venue} value={place} onChange={setPlace} />}
        </View>
        {sentiment ? (
          <Body tone="muted" align="center">
            {error ? 'Not saved yet.' : 'Placing it…'}
          </Body>
        ) : list ? (
          <SentimentButtons onPick={pick} />
        ) : (
          <Body tone="muted" align="center">
            {listFailed ? "Couldn't load your list, so there's nothing to compare with yet. Close this and try again." : 'Loading your list…'}
          </Body>
        )}
        {existing && !sentiment ? <Caption tone="muted" align="center">{`You ranked this ${formatScore(existing.score)} before. Ranking it again replaces that.`}</Caption> : null}
      </>
    );
  }

  return (
    <Sheet visible kind="flow" onClose={onClose} accessibilityLabel={`Rank ${drink.name}`} header={<Head title={title} done={!!landed} />}>
      <SheetScrollView contentContainerStyle={[styles.body, !landed && !comparing && styles.first, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        {body}
        {saving ? (
          <Caption tone="muted" align="center">
            Saving…
          </Caption>
        ) : null}
        {error ? (
          <View style={styles.error}>
            <Caption tone="muted">{error}</Caption>
            <Button label="Try again" variant="secondary" onPress={() => void save(sentiment!, answers)} />
          </View>
        ) : null}
      </SheetScrollView>
    </Sheet>
  );
}

/**
 * The sheet's top row: Close (Android's back arrow, as its full-height
 * sheets have), the step ("2 of 3") and, once it's placed, Done.
 */
function Head({ title, done }: { title: string; done: boolean }) {
  const ds = useDs();
  const close = useSheetClose();
  const android = Platform.OS === 'android';
  return (
    <View style={styles.head}>
      <GlassButton accessibilityLabel={android ? 'Back' : 'Close'} icon={android ? 'chevron.left' : 'xmark'} onPress={close} />
      <Body style={styles.title} align="center" numberOfLines={1}>
        {title}
      </Body>
      {done ? (
        <PressableScale accessibilityLabel="Done" onPress={close} style={[styles.done, { backgroundColor: ds.accentFill.fill }]}>
          <IconSymbol name="checkmark" size={18} color={ds.accentFill.text} />
        </PressableScale>
      ) : (
        <View style={styles.done} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  title: { flex: 1, ...font.semiBold },
  done: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.md, gap: space.xl },
  // How was it sits low, where the drawn small sheet sits and a thumb reaches.
  first: { justifyContent: 'flex-end' },
  center: { alignItems: 'center', gap: space.sm },
  error: { gap: space.sm, alignItems: 'flex-start' },
});
