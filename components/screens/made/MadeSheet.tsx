import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useLogMade } from '@/hooks/useMade';
import { useAddRankEntry, useMyRankList, useRankTarget, useRecordComparisons } from '@/hooks/useRankings';
import { parseDay, toDay } from '@/lib/collection';
import { cleanSwaps, placeBeside, SWAP_LIMIT, SWAP_NAME_LIMIT, type Compared, type Swap } from '@/lib/madeIt';
import { formatScore, rankedAs as rankedAsOf } from '@/lib/ranking';

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
  onClose: () => void;
}

/**
 * "I made it": log a drink made at home (made_drinks). When you had it at a
 * bar, say how yours compared: that places your home version beside the
 * bar's in your rankings (a made-at-home rank_entries row), which is the
 * score your profile shows if you share rankings. Then what you swapped,
 * when, and a note. Open it after the age check.
 */
export function MadeSheet({ item, ingredients, onClose }: MadeSheetProps) {
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
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saving = addEntry.isPending || record.isPending || log.isPending;
  const names = [...new Set(ingredients.filter(Boolean))];

  const toggleSwap = (from: string) =>
    setSwaps((s) => (s.some((x) => x.from === from) ? s.filter((x) => x.from !== from) : s.length < SWAP_LIMIT ? [...s, { from, to: '' }] : s));
  const setTo = (from: string, to: string) => setSwaps((s) => s.map((x) => (x.from === from ? { ...x, to: to.slice(0, SWAP_NAME_LIMIT) } : x)));

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
      subtitle="You made it"
      footer={<Button label={saving ? 'Saving…' : 'Save'} size="lg" onPress={submit} disabled={saving} />}
    >
      {barEntry ? (
        <>
          <Caption tone="muted">{`Next to the one you had at ${barEntry.venue?.display_name ?? 'the bar'} (${formatScore(barEntry.score)})`}</Caption>
          <View role="radiogroup" accessibilityLabel="How yours compared" style={styles.wrap}>
            {COMPARE.map((c) => (
              <Choice key={c.value} label={c.label} selected={compared === c.value} onPress={() => setCompared(compared === c.value ? null : c.value)} />
            ))}
          </View>
        </>
      ) : null}
      {names.length ? (
        <>
          <Caption tone="muted">What you swapped</Caption>
          <View role="group" accessibilityLabel="What you swapped" style={styles.wrap}>
            {names.map((n) => (
              <Choice key={n} kind="checkbox" label={n} selected={swaps.some((s) => s.from === n)} onPress={() => toggleSwap(n)} />
            ))}
          </View>
          {swaps.map((s) => (
            <Field key={s.from} label={`Instead of ${s.from}`} value={s.to} onChangeText={(t) => setTo(s.from, t)} placeholder="What you used" />
          ))}
        </>
      ) : null}
      <Caption tone="muted">When</Caption>
      <View role="radiogroup" accessibilityLabel="When you made it" style={styles.wrap}>
        <Choice label="Today" selected={date === today} onPress={() => setDate(today)} />
        <Choice label="Yesterday" selected={date === yesterday} onPress={() => setDate(yesterday)} />
      </View>
      <DateField label="Date" value={date} onChange={setDate} max={today} />
      <Field
        label="Note"
        value={note}
        onChangeText={(t) => setNote(t.slice(0, NOTE_LIMIT))}
        placeholder="How it came out, what you'd change next time"
        multiline
        hint={note.length > NOTE_LIMIT - 100 ? `${NOTE_LIMIT - note.length} characters left` : 'Only you see this.'}
      />
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
