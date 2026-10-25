import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs, type MatchTextProps } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useSaveSpelling, useSearchNear } from '@/hooks/useSearchNear';
import { classicHit, mergeNear, nearIn, nearView, searchItemHit, type NearHit, type NearKind } from '@/lib/nearHits';
import type { Area } from '@/lib/nearMe';
import type { SearchItem } from '@/types/search';

import { ResultGroup, ResultRow } from './ResultRows';

const NONE: readonly never[] = [];

interface NearResultsProps {
  query: string;
  /** What the plain search found here: nothing asks about the closest name, something lists them last. */
  found: number;
  /** Rows already on screen, by id. */
  shown: readonly string[];
  /** Your drinks or the venue's. */
  yours?: readonly SearchItem[];
  /** What their rows say: "Little Rye", "Yours". */
  yoursCaption?: string;
  /** The classics, when this search shows them. */
  classics?: readonly { id: string; name: string; imageUrl?: string | null }[];
  /** Ask the database too, in this area, for these kinds. */
  server?: { area: Area; kinds: readonly NearKind[] } | null;
  /** "Nothing at Little Rye called “salty boy”". */
  title: string;
  /** What nothing found shows when nothing is close either (and after a plain "No"). */
  miss: ReactNode;
  /** Above a saved spelling's results: the place's own miss card, with its add. */
  lead?: ReactNode;
  /** "No": the place's own add, "add Salty Boy". Without it "No" leaves the miss. */
  add?: { label: string; onPress: () => void };
  matchLook?: MatchTextProps['look'];
}

/**
 * "Did you mean", after a search's own results (whole-app canvas, Search page,
 * "Did you mean, in every search"). Nothing found as typed: one card asks
 * about the closest name, "Yes, that's it" opens it and keeps the spelling
 * for next time, "No" is the place's own add; the rest follow as "Also
 * close" (1B). Something found: the close names come last, "Spelled
 * differently" (1C).
 */
export function NearResults({ query, found, shown, yours, yoursCaption = 'Yours', classics, server, title, miss, lead, add, matchLook }: NearResultsProps) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const save = useSaveSpelling();
  const q = query.trim();
  const kinds = server?.kinds ?? NONE;
  const main = useSearchNear(q, { area: server?.area, kinds: kinds.filter((k) => k !== 'ingredient'), enabled: !!server });
  // Ingredients in a call of their own: there are 20,000 of them.
  const ingredients = useSearchNear(q, { area: server?.area, kinds: kinds.filter((k) => k === 'ingredient'), enabled: !!server });
  const local = useMemo(
    () => [...nearIn(q, yours ?? NONE, (i) => searchItemHit(i, yoursCaption)), ...nearIn(q, classics ?? NONE, classicHit)],
    [q, yours, yoursCaption, classics]
  );
  const hits = useMemo(() => mergeNear([local, main.data ?? NONE, ingredients.data ?? NONE], new Set(shown)), [local, main.data, ingredients.data, shown]);
  const view = nearView(found, hits);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const open = (h: NearHit) => router.push(h.href as never);
  const row = (h: NearHit) =>
    h.kind === 'drink' ? (
      <DrinkRow key={h.id} name={h.name} itemId={h.spellingFor} imageUrl={h.imageUrl} glass={null} caption={h.caption ?? undefined} onPress={() => open(h)} />
    ) : (
      <ResultRow
        key={h.id}
        title={h.name}
        caption={h.caption ?? undefined}
        avatar={h.kind === 'bar' ? { uri: null, bar: { profileId: h.id } } : h.kind === 'person' ? { uri: null } : undefined}
        ingredient={h.kind === 'ingredient' ? { id: h.id } : undefined}
        matchLook={matchLook}
        onPress={() => open(h)}
      />
    );

  if (view.kind === 'none') return found ? null : <>{miss}</>;
  if (view.kind === 'listed') return <ResultGroup label="Spelled differently" items={view.hits} render={row} />;
  if (view.kind === 'known') {
    return (
      <View style={styles.groups}>
        {lead}
        <ResultGroup label={`Also spelled “${q}”`} items={view.known} render={row} />
        <ResultGroup label="Also close" items={view.also} render={row} />
      </View>
    );
  }
  if (dismissed === q) return <>{miss}</>;

  const { best } = view;
  const spellingFor = signedIn ? best.spellingFor : null;
  const yes = () => {
    if (spellingFor) save.mutate({ itemId: spellingFor, typed: q });
    open(best);
  };
  return (
    <View style={styles.groups}>
      <AskCard title={title} name={best.name} best={row(best)}>
        <View style={styles.buttons}>
          <Button label="Yes, that’s it" size="sm" onPress={yes} />
          <Button label={add ? `No, ${add.label}` : 'No'} variant="secondary" size="sm" icon={add ? 'plus' : undefined} onPress={add ? add.onPress : () => setDismissed(q)} />
        </View>
        {spellingFor ? <Caption tone="muted">{`Yes keeps “${q}” as another spelling, so it finds ${best.name} next time.`}</Caption> : null}
      </AskCard>
      <ResultGroup label="Also close" items={view.also} render={row} />
    </View>
  );
}

/** The miss card's look (MissCard), asking about one row. */
function AskCard({ title, name, best, children }: { title: string; name: string; best: ReactNode; children: ReactNode }) {
  const ds = useDs();
  return (
    <View role="group" aria-label={`Did you mean ${name}?`} style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: ds.c.ground }]}>
          <IconSymbol name="magnifyingglass" size={20} color={ds.c.muted} />
        </View>
        <View style={styles.text}>
          <Body role="heading" style={styles.title}>
            {title}
          </Body>
          <Caption tone="muted">Did you mean this one?</Caption>
        </View>
      </View>
      <View style={[styles.inset, { backgroundColor: ds.c.ground }]}>{best}</View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.lg },
  card: { gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamilies.bodySemiBold },
  inset: { borderRadius: radius.control, paddingHorizontal: space.sm, overflow: 'hidden' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
