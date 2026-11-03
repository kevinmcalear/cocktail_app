import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, useDs } from '@/components/ds';
import { BlockLabel, ScoreRow } from '@/components/screens/rankings/ScoreRows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, scoreFigure, space } from '@/constants/tokens';
import { useDrinkRankings, type RankEntry, type RankVenue } from '@/hooks/useRankings';
import { useSetRankReasons } from '@/hooks/useRankResult';
import { heroPicture, type ItemPicture } from '@/lib/itemImages';
import { DRINK_REASONS, entryLine, landedLine, MAX_DRINK_REASONS, neighbours, ordinal, placeInList, ROOM_REASONS, toggleReason } from '@/lib/rankResult';
import { formatScore, MIN_RANKERS, plural, type Sentiment } from '@/lib/ranking';

import { ReasonChips, tick } from './RankParts';

export interface Landed {
  entryId: string;
  sentiment: Sentiment;
  /** Where it went in its band, 0 = best. */
  index: number;
}

interface RankResultProps {
  landed: Landed;
  drink: { id: string; name: string; picture: ItemPicture | null };
  rankedAs: { id: string; name: string };
  venue: RankVenue | null;
  /** My list without this drink, best first. */
  others: RankEntry[];
}

/**
 * Where it landed (Prod-rank-A step 3): the score, your list around it, what
 * it means near you; then what stood out, up to two (Loop-rank), and the room
 * when it was had at a bar (Kept-score). Reasons save on every tap.
 */
export function RankResult({ landed, drink, rankedAs, venue, others }: RankResultProps) {
  const ds = useDs();
  const rows = placeInList(others, landed.sentiment, landed.index);
  const mine = rows.find((r) => !r.entry)!;
  const where = venue?.display_name ?? 'Home';
  const save = useSetRankReasons();
  const [reasons, setReasons] = useState<string[]>([]);
  const [room, setRoom] = useState<string[]>([]);

  const send = (nextReasons: string[], nextRoom: string[]) => {
    if (nextReasons === reasons && nextRoom === room) return; // a third reason past the two
    tick();
    setReasons(nextReasons);
    setRoom(nextRoom);
    save.mutate({ entryId: landed.entryId, reasons: nextReasons, room: nextRoom });
  };

  return (
    <View style={styles.result}>
      <View style={styles.center}>
        <DsText variant="display" align="center" accessibilityLabel={`Your score: ${formatScore(mine.score)} out of 10`} style={scoreFigure}>
          {formatScore(mine.score)}
        </DsText>
        <Body tone="muted" align="center">
          {landedLine(mine.position, rows.length, rankedAs.name)}
        </Body>
      </View>
      <View>
        {neighbours(rows).map((r) => {
          if (!r.entry) return <ScoreRow key="new" mine position={r.position} itemId={drink.id} pictureUrl={drink.picture?.url} pictureIsSketch={drink.picture?.isSketch} title={where} sub="Tonight" score={r.score} />;
          const e = r.entry;
          const picture = heroPicture(e.item?.item_images);
          const sub = entryLine(e, rankedAs.name);
          return <ScoreRow key={e.id} position={r.position} itemId={e.item_id} pictureUrl={picture?.url} pictureIsSketch={picture?.isSketch} title={e.venue?.display_name ?? 'Home'} sub={sub} score={r.score} />;
        })}
      </View>
      {venue ? <NearYou venue={venue} rankedAs={rankedAs} /> : null}

      <View style={styles.block}>
        <BlockLabel aside={reasons.length ? `${reasons.length} of ${MAX_DRINK_REASONS}` : 'Up to two, or skip'}>What stood out?</BlockLabel>
        <ReasonChips reasons={DRINK_REASONS} picked={reasons} label="What stood out? Up to two" onToggle={(k) => send(toggleReason(reasons, k, MAX_DRINK_REASONS), room)} />
        <Caption tone="muted">{`Tied to this version of the spec. ${venue ? 'The bar sees' : 'Its makers see'} totals, never your name.`}</Caption>
      </View>

      {venue ? (
        <View style={styles.block}>
          <BlockLabel caps={false}>And the room? Optional</BlockLabel>
          <ReasonChips reasons={ROOM_REASONS} picked={room} label="And the room? Optional" onToggle={(k) => send(reasons, toggleReason(room, k))} />
          <Note icon="lock.fill">{`The room doesn’t change any score. ${venue.display_name} sees these added up, never who said them.`}</Note>
        </View>
      ) : null}
      {save.isError ? <Caption color={ds.accentText}>{save.error.message}</Caption> : null}
    </View>
  );
}

/**
 * The bar's drink in its city's list, if it's in it: "Caretaker's Negroni is
 * 2nd in New York." The list refreshes hourly, so this rank counts within the hour.
 */
function NearYou({ venue, rankedAs }: { venue: RankVenue; rankedAs: { id: string; name: string } }) {
  const area = venue.city && venue.country_code ? { p_city: venue.city, p_country_code: venue.country_code } : null;
  const { data } = useDrinkRankings(rankedAs.id, area);
  if (!area || !data || !venue.city) return null;
  const row = data.find((r) => r.venue_profile_id === venue.id);
  const drink = `${venue.display_name}’s ${rankedAs.name}`;
  return (
    <Note icon="list.number">
      {row ? `${drink} is ${ordinal(row.position)} in ${venue.city}. Yours counts within the hour.` : `${drink} joins the ${venue.city} list of ${plural(rankedAs.name)} once ${MIN_RANKERS} people have ranked it there.`}
    </Note>
  );
}

function Note({ icon, children }: { icon: 'lock.fill' | 'list.number'; children: string }) {
  const ds = useDs();
  return (
    <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name={icon} size={16} color={ds.c.muted} />
      <Caption style={styles.flex}>{children}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  result: { gap: space.lg },
  center: { alignItems: 'center', gap: space.xs },
  block: { gap: space.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  flex: { flex: 1 },
});
