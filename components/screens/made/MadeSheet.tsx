import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, DsText, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { fontFamilies, space } from '@/constants/tokens';
import { useAddDrinkPhoto } from '@/hooks/useDrinkPhotos';
import { useLogMade } from '@/hooks/useMade';
import { useAddRankEntry, useMyRankList, useRankTarget, useRecordComparisons } from '@/hooks/useRankings';
import { parseDay, toDay } from '@/lib/collection';
import { cleanSwaps, placeBeside, type Compared, type Swap } from '@/lib/madeIt';
import { formatScore, rankedAs as rankedAsOf, rankScore } from '@/lib/ranking';
import { useShelfCheck } from '@/hooks/useShelfCheck';
import type { SpecLine } from '@/lib/spec';

import { PhotoTile, SwapChips, WhenChips } from './MadeParts';

const NOTE_LIMIT = 1000;
const COMPARE: { value: Compared; label: string }[] = [
  { value: 'better', label: 'Better' },
  { value: 'same', label: 'About the same' },
  { value: 'worse', label: 'Not as good' },
];

interface MadeSheetProps {
  item: { id: string; name: string };
  /** The spec's ingredient names, to say what you swapped. */
  ingredients: string[];
  /** The spec, to fill in what you changed from your shelf. */
  lines?: SpecLine[];
  /** The bar it's from: "Your version of Little Rye's". */
  barName?: string | null;
  onClose: () => void;
}

/**
 * "I made it": log a drink made at home (made_drinks). When you had it at a
 * bar, say how yours compared: that places your home version beside the
 * bar's in your rankings (a made-at-home rank_entries row), which is the
 * score your profile shows if you share rankings. Then what you swapped,
 * when, and a note. Open it after the age check.
 */
export function MadeSheet({ item, ingredients, lines = [], barName, onClose }: MadeSheetProps) {
  const { data: target } = useRankTarget(item.id);
  const rankedAs = target ? rankedAsOf(target) : null;
  const { data: list } = useMyRankList(rankedAs?.id);
  // The list is best first, so this is the best of their bar visits.
  const barEntry = list?.find((e) => e.item_id === item.id && e.venue_profile_id !== null) ?? null;
  const homeEntry = list?.find((e) => e.item_id === item.id && e.venue_profile_id === null) ?? null;
  const addEntry = useAddRankEntry();
  const record = useRecordComparisons();
  const log = useLogMade();
  const [{ today, yesterday }] = useState(() => {
    const now = new Date();
    return { today: toDay(now), yesterday: toDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) };
  });
  const [date, setDate] = useState(today);
  const [compared, setCompared] = useState<Compared | null>(null);
  // What you changed starts from your shelf: the bottle you didn't have, and the one closest to it.
  const shelf = useShelfCheck(item.id, lines);
  const fromShelf: Swap[] = shelf.missingName && shelf.closest ? [{ from: shelf.missingName, to: shelf.closest }] : [];
  const [edited, setSwaps] = useState<Swap[] | null>(null);
  const swaps = edited ?? fromShelf;
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const addPhoto = useAddDrinkPhoto(item.id);
  const [error, setError] = useState<string | null>(null);
  const saving = addEntry.isPending || record.isPending || log.isPending || addPhoto.isPending;
  const names = [...new Set(ingredients.filter(Boolean))];

  // Where yours lands, the way ranking works, before you save it.
  const preview = (() => {
    if (!barEntry || !compared || !list) return null;
    const band = list.filter((e) => e.sentiment === barEntry.sentiment && e.id !== homeEntry?.id);
    const { index } = placeBeside(band.map((e) => e.rank_key), band.indexOf(barEntry), compared);
    return rankScore(barEntry.sentiment, index, band.length + 1);
  })();

  const submit = async () => {
    const madeOn = parseDay(date);
    if (!madeOn) return setError('Pick a day.');
    if (madeOn > today) return setError('That day hasn’t happened yet.');
    setError(null);
    try {
      let rankEntryId = homeEntry?.id ?? null;
      if (barEntry && compared && rankedAs && list) {
        const band = list.filter((e) => e.sentiment === barEntry.sentiment && e.id !== homeEntry?.id);
        const { rankKey } = placeBeside(band.map((e) => e.rank_key), band.indexOf(barEntry), compared);
        const row = await addEntry.mutateAsync({
          ...(homeEntry ? { id: homeEntry.id } : {}),
          item_id: item.id,
          ranked_as_item_id: rankedAs.id,
          venue_profile_id: null,
          sentiment: barEntry.sentiment,
          rank_key: rankKey,
          had_on: madeOn,
        });
        rankEntryId = row.id;
        await record.mutateAsync([
          compared === 'better'
            ? { winner_entry_id: row.id, loser_entry_id: barEntry.id, is_tie: false }
            : { winner_entry_id: barEntry.id, loser_entry_id: row.id, is_tie: compared === 'same' },
        ]);
      }
      await log.mutateAsync({ item_id: item.id, made_on: madeOn, compared, swaps: cleanSwaps(swaps), note: note.trim() || null, rank_entry_id: rankEntryId });
      if (photo) await addPhoto.mutateAsync({ uri: photo, rankEntryId });
      onClose();
    } catch (e) {
      // Supabase errors are plain objects, not Errors: say what went wrong either way.
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : null;
      setError(message ? `Couldn’t save that: ${message}` : 'Couldn’t save that. Try again.');
    }
  };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={item.name}
      subtitle={(barName ?? barEntry?.venue?.display_name) ? `Your version of ${barName ?? barEntry?.venue?.display_name}'s` : 'Your version'}
      footer={<Button label={saving ? 'Saving…' : 'Save'} size="lg" onPress={submit} disabled={saving} />}
    >
      {barEntry ? (
        <>
          <DsText style={styles.strong}>{`Next to the one you had at ${barEntry.venue?.display_name ?? 'the bar'} (${formatScore(barEntry.score)})`}</DsText>
          <View role="radiogroup" accessibilityLabel="How yours compared" style={styles.wrap}>
            {COMPARE.map((c) => (
              <Choice key={c.value} label={c.label} selected={compared === c.value} onPress={() => setCompared(compared === c.value ? null : c.value)} />
            ))}
          </View>
          {preview !== null ? <Body>{`We place it among your drinks, the way ranking works: ${formatScore(preview)} for now.`}</Body> : null}
        </>
      ) : null}
      {names.length ? (
        <>
          <DsText style={styles.strong}>What you changed</DsText>
          <SwapChips names={names} swaps={swaps} onChange={setSwaps} />
          {!edited && fromShelf.length ? <Caption tone="muted">{`Filled in from your shelf: you didn't have ${fromShelf[0].from}.`}</Caption> : null}
        </>
      ) : null}
      <WhenChips date={date} today={today} yesterday={yesterday} onDate={(d) => { setDate(d); setPicking(false); }} picking={picking} onPick={() => setPicking(true)} />
      {picking ? <DateField label="Date" value={date} onChange={setDate} max={today} /> : null}
      {/* A photo beside the note (board drink-sheet-made). */}
      <View style={styles.noteRow}>
        <PhotoTile uri={photo} onUri={setPhoto} />
        <View style={styles.flex}>
          <Field
            label="Note"
            value={note}
            onChangeText={(t) => setNote(t.slice(0, NOTE_LIMIT))}
            placeholder="How it came out, what you'd change next time"
            multiline
            hint={note.length > NOTE_LIMIT - 100 ? `${NOTE_LIMIT - note.length} characters left` : undefined}
          />
        </View>
      </View>
      {photo ? <Caption tone="muted">{"Your photo goes with this drink's photos, with your name on it."}</Caption> : null}
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
