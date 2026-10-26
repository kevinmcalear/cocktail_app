import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, DsText, Field, ReviewRow, TextLink, Title, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useBringInMatchData } from '@/hooks/useBringInMatchData';
import type { VenueBottle } from '@/hooks/useBulk';
import { shelfOrder, type ShelfSpot } from '@/lib/bringIn';
import { plainKind, type MatchData } from '@/lib/bringInMatch';
import { catalogIndex, matchIngredient, type CatalogItem } from '@/lib/match';
import type { AnythingReading, ReadFile } from '@/lib/readAnything';
import type { BottleReading } from '@/supabase/functions/_shared/bottleRead';

import { CheckFooter, CheckTop } from './CheckParts';
import { PagePicture, SourceCrop } from './PagePicture';

type Decision = { skip: true } | { pick: string } | { typed: string };

/** What a bottle comes to: on the shelf already, added as a catalog bottle, made new at the venue, or left out. */
export type BottleOutcome =
  | { state: 'have'; item: CatalogItem }
  | { state: 'add'; item: CatalogItem; plain?: boolean }
  | { state: 'make'; bottle: VenueBottle; kind: CatalogItem | null }
  | { state: 'pick'; items: CatalogItem[]; plain: CatalogItem | null }
  | { state: 'skip'; why: string };

export function bottleOutcome(reading: BottleReading, data: MatchData, decision: Decision | undefined): BottleOutcome {
  if (decision && 'skip' in decision) return { state: 'skip', why: 'Skipped' };
  const read = decision && 'typed' in decision ? { ...reading, name: decision.typed, brand: null } : reading;
  const match = matchIngredient(read, data.catalog, data.venueId, data.aliases);
  const owned = (item: CatalogItem) => (data.venueId ? item.barId === data.venueId || !!catalogIndex(data.catalog).byKind.get(item.id)?.some((e) => e.item.barId === data.venueId) : data.shelf.includes(item.id));
  if (match.kind === 'one') return owned(match.item) ? { state: 'have', item: match.item } : { state: 'add', item: match.item };
  if (match.kind === 'pick') {
    const chosen = match.items.find((i) => decision && 'pick' in decision && i.id === decision.pick);
    if (chosen) return owned(chosen) ? { state: 'have', item: chosen } : { state: 'add', item: chosen };
    return { state: 'pick', items: match.items, plain: plainKind(read.name, match.items, data) };
  }
  if (data.venueId) return { state: 'make', bottle: { name: read.name, genericId: match.kindItem?.id ?? null, brand: read.brand, abv: read.abv }, kind: match.kindItem };
  return match.kindItem ? { state: 'add', item: match.kindItem, plain: true } : { state: 'skip', why: 'Not in the catalog yet. Search for it in Add bottles' };
}

interface BottlesCheckProps {
  reading: AnythingReading;
  files: ReadFile[];
  data: MatchData;
  /** "My Bar", or the venue's name. */
  where: string;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onRetake: () => void;
  onSave: (input: { shelf: string[]; venue: VenueBottle[]; had: number }) => void;
}

/**
 * The bottles check (canvas make-bringin-bottles): your photo with each
 * bottle numbered, the count of what's new, there, to pick and unreadable,
 * and a numbered row for every bottle. An open pick still lands, as the plain
 * kind; one it couldn't read can be retaken, typed or skipped.
 */
export function BottlesCheck({ reading, files, data, where, saving, error, onCancel, onRetake, onSave }: BottlesCheckProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [typing, setTyping] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const spots = useMemo(() => shelfOrder(reading), [reading]);
  const keyOf = (spot: ShelfSpot) => `${spot.kind}:${spot.index}`;
  const decide = (spot: ShelfSpot, d: Decision | null) =>
    setDecisions((prev) => {
      const next = { ...prev };
      if (d) next[keyOf(spot)] = d;
      else delete next[keyOf(spot)];
      return next;
    });

  // A name typed in is matched as the photo's bottles were (on the server, with them); its row stays unread until then.
  const names = [...new Set(Object.values(decisions).flatMap((d) => ('typed' in d ? [d.typed] : [])))];
  const withTyped = useBringInMatchData(data.venueId, names.length > 0, [reading.kind === 'bottles' ? reading.bottles : [], ...names.map((name) => [{ name }])]);
  const typedData = names.length ? withTyped : data;

  // Matched once for the photo and again only when a pick changes: not as you type, and not while saving
  // (the save fills the shelf, which would turn its own bottles to "already there" under the button).
  const [sent, setSent] = useState<(BottleOutcome | null)[] | null>(null);
  const outcomes = useMemo(
    () =>
      saving && sent
        ? sent
        : spots.map((spot) => {
            const d = decisions[`${spot.kind}:${spot.index}`];
            if (spot.kind === 'bottle') return bottleOutcome(spot.reading, typedData ?? data, d);
            if (d && 'typed' in d) return typedData ? bottleOutcome({ brand: null, name: d.typed, kind: null, abv: null }, typedData, d) : null;
            return d ? ({ state: 'skip', why: 'Skipped' } as const) : null;
          }),
    [saving, sent, spots, decisions, data, typedData]
  );
  const count = (s: BottleOutcome['state']) => outcomes.filter((o) => o?.state === s).length;
  const adding = count('add') + count('make') + count('pick');
  const unread = outcomes.filter((o) => o === null).length;
  const firstPick = spots.find((_, i) => outcomes[i]?.state === 'pick');
  const pickOutcome = firstPick ? (outcomes[spots.indexOf(firstPick)] as Extract<BottleOutcome, { state: 'pick' }>) : null;
  const pickName = firstPick?.kind === 'bottle' ? firstPick.reading.name : '';
  const counts = [`${count('add') + count('make')} new to ${where}`, `${count('have')} already there`, count('pick') ? `${count('pick')} to pick` : null, unread ? `${unread} couldn’t read` : null].filter(Boolean).join(' · ');
  const photo = files.find((f) => f.mimeType.startsWith('image/')) ?? null;
  const marks = spots.flatMap((spot, i) => {
    const at = spot.kind === 'bottle' ? spot.reading.at : spot.box ? { page: spot.page ?? 0, box: spot.box } : null;
    return at && files[at.page] === photo ? [{ box: at.box, dashed: outcomes[i]?.state !== 'have', label: String(i + 1) }] : [];
  });

  const save = () => {
    const shelf: string[] = [];
    const venue: VenueBottle[] = [];
    const put = (item: CatalogItem) => {
      if (data.venueId) venue.push({ name: item.name, genericId: item.id, brand: null, abv: null });
      else shelf.push(item.id);
    };
    for (const o of outcomes) {
      if (o?.state === 'add') put(o.item);
      if (o?.state === 'make') venue.push(o.bottle);
      if (o?.state === 'pick' && o.plain) put(o.plain);
    }
    setSent(outcomes);
    onSave({ shelf: [...new Set(shelf)], venue, had: count('have') });
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={[styles.photo, { backgroundColor: ds.c.surface, paddingTop: insets.top + space.sm }]}>
          <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
            <CheckTop kind="bottles" onCancel={onCancel} close />
          </View>
          {photo ? <PagePicture file={photo} width={Math.min(width, 640) - gutter * 2} maxHeight={248} marks={marks} style={styles.picture} /> : null}
        </View>
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <Title>{`${spots.length} ${spots.length === 1 ? 'bottle' : 'bottles'}`}</Title>
          <Caption tone="muted">{counts}</Caption>
          <View role="list">
            {spots.map((spot, i) => {
              const o = outcomes[i];
              const n = (
                <View style={[styles.number, { backgroundColor: ds.c.raised }]}>
                  <DsText variant="caption">{String(i + 1)}</DsText>
                </View>
              );
              if (!o) {
                const box = spot.kind === 'unreadable' ? spot.box : null;
                return (
                  <ReviewRow key={keyOf(spot)} state="pick" mutedTitle lead={n} title="Couldn’t read this one" end={<SourceCrop file={photo} box={box} words="" width={40} height={40} />}>
                    {typing === keyOf(spot) ? (
                      <View style={styles.type}>
                        <Field label="What is it?" value={typed} onChangeText={setTyped} autoFocus placeholder="Campari" />
                        <Button label="Use it" disabled={!typed.trim()} onPress={() => { decide(spot, { typed: typed.trim() }); setTyping(null); setTyped(''); }} />
                      </View>
                    ) : (
                      <View style={styles.links}>
                        <TextLink label="Retake" onPress={onRetake} />
                        <TextLink label="Type it" onPress={() => setTyping(keyOf(spot))} />
                        <TextLink label="Skip" onPress={() => decide(spot, { skip: true })} />
                      </View>
                    )}
                  </ReviewRow>
                );
              }
              const name = spot.kind === 'bottle' ? spot.reading.name : (decisions[keyOf(spot)] as { typed: string }).typed;
              const kindWord = spot.kind === 'bottle' ? spot.reading.kind : null;
              if (o.state === 'have') return <ReviewRow key={keyOf(spot)} state="have" lead={n} markAtEnd title={name} detail={`Already on ${where === 'My Bar' ? 'your shelf' : where}`} />;
              if (o.state === 'pick') {
                const doubt = spot.kind === 'bottle' ? spot.reading.doubt : null;
                return <ReviewRow key={keyOf(spot)} state="pick" lead={n} markAtEnd title={name} detail={doubt ? `Which one? ${doubt}` : 'Which one?'} choices={o.items.map((it) => ({ id: it.id, label: it.name }))} onChoose={(id) => decide(spot, { pick: id })} />;
              }
              if (o.state === 'skip') return <ReviewRow key={keyOf(spot)} state="skip" lead={n} markAtEnd title={name} detail={o.why} action={o.why === 'Skipped' ? { label: 'Bring back', onPress: () => decide(spot, null) } : undefined} />;
              const what = o.state === 'add' ? (o.plain ? `as plain ${o.item.name}` : kindWord) : (o.kind?.name ?? kindWord);
              return <ReviewRow key={keyOf(spot)} state="new" lead={n} markAtEnd title={name} detail={[`New to ${where === 'My Bar' ? 'your shelf' : where}`, what].filter(Boolean).join(' · ')} onPress={() => decide(spot, { skip: true })} pressHint="Leaves it out" />;
            })}
          </View>
          {error ? <Caption tone="accent">{error}</Caption> : null}
        </View>
      </ScrollView>
      <CheckFooter note={firstPick ? `Pick the ${pickName}, or it waits on your shelf as “${pickOutcome?.plain?.name ?? pickName}”` : null}>
        <Button label={saving ? 'Adding…' : `Add ${adding} to ${where}`} size="lg" disabled={saving || !adding} onPress={save} />
      </CheckFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  photo: { paddingBottom: space.lg, gap: space.md },
  topBar: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  picture: { borderRadius: radius.control },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingTop: space.lg, gap: space.xs },
  number: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', gap: space.md },
  type: { gap: space.sm },
});
