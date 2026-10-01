import { useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Chip, Display, Field, GlassButton, Headline, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useBarRiffs, useOffMenu, useOffMenuEdit, type OffMenuPick } from '@/hooks/useOffMenu';
import { plainDbMessage } from '@/lib/dbError';
import { bandOf, candidatesFor, nextRank, patronGroups } from '@/lib/offMenu';
import { roleLabel } from '@/lib/roles';

function problem(error: unknown): string {
  return plainDbMessage(error) ?? "Couldn't save that. Check your connection and try again.";
}

const NO_PICKS: OffMenuPick[] = [];

/**
 * Classics this venue can make that aren't on the menu, and which to
 * recommend first. Ranks 1–10 are the top 10; 11–40 are the rest of the top
 * 40. Drink Creators edit it; everyone on the floor can read it.
 */
export function OffMenuScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const sidebar = useIsWideWeb();
  const home = useMode().mode === 'home';
  const { active } = useActiveVenue();
  const barId = !home && active ? active.id : null;
  const caps = useCapabilities(barId);
  const canEdit = Array.isArray(caps.data) && caps.data.includes('menus');
  const { data: opensAt } = useCapabilityOpensAt(barId, 'menus');
  const picks = useOffMenu(barId);
  const riffs = useBarRiffs(canEdit ? barId : null);
  const catalog = useDrinkLists();
  const edit = useOffMenuEdit(barId);
  const [query, setQuery] = useState('');

  const rows = picks.data ?? NO_PICKS;
  const groups = patronGroups(rows);
  const taken = useMemo(() => new Set(rows.map((p) => p.itemId)), [rows]);
  const results = useMemo(
    () => candidatesFor(riffs.data ?? [], catalog.data ?? [], query, taken),
    [riffs.data, catalog.data, query, taken],
  );
  const ranks = rows.map((p) => p.rank);
  const top10 = nextRank(ranks, 'top10');
  const top40 = nextRank(ranks, 'top40');

  const rank = (pick: OffMenuPick, next: number | null) => {
    if (next == null || edit.isPending) return;
    edit.mutate({ op: 'rank', itemId: pick.itemId, rank: next });
  };

  let body: ReactNode;
  if (!barId) body = <Body tone="muted">Off-menu classics are part of a venue. Switch to your bar to see them.</Body>;
  else if (picks.isLoading) body = <Caption tone="muted">Loading classics…</Caption>;
  else if (picks.error) body = <Body tone="muted">Couldn’t load the list. Check your connection and try again.</Body>;
  else
    body = (
      <>
        <Caption tone="muted">
          Classics you can make that aren’t on the menu. The top 10 are the ones to suggest first. The top 40 is the longer list.
        </Caption>
        {canEdit ? (
          <>
            <Field label="Add a classic" value={query} onChangeText={setQuery} placeholder="Martini, Negroni" autoCapitalize="none" autoCorrect={false} />
            {results.map((c) => (
              <View key={c.id} style={styles.addRow}>
                <View style={styles.addName}>
                  <Body>{c.name}</Body>
                  {c.classicName && c.classicName !== c.name ? <Caption tone="muted">{c.classicName}</Caption> : null}
                </View>
                <Button label="Add" variant="secondary" disabled={edit.isPending} onPress={() => edit.mutate({ op: 'add', itemId: c.id }, { onSuccess: () => setQuery('') })} />
              </View>
            ))}
            {query.trim() && !results.length ? <Caption tone="muted">Nothing matches that yet. Link a drink to a classic first, or search the catalog name.</Caption> : null}
          </>
        ) : (
          <Caption tone="muted">{`Ranking this list opens at ${opensAt ? roleLabel(opensAt) : 'Drink Creator'}.`}</Caption>
        )}
        {edit.error ? <Caption>{problem(edit.error)}</Caption> : null}
        {canEdit && top10 == null ? <Caption tone="muted">The top 10 is full. Move one out to free a spot.</Caption> : null}
        {canEdit && top40 == null ? <Caption tone="muted">The top 40 is full.</Caption> : null}
        {!rows.length ? <Body tone="muted">None yet. Add the classics you’d pour if someone asked.</Body> : null}
        <Group title="Top 10" hint="Recommend these first" rows={groups.top10} canEdit={canEdit} pending={edit.isPending} top10={top10} top40={top40} onRank={rank} onAlso={(p) => edit.mutate({ op: 'rank', itemId: p.itemId, rank: null })} onRemove={(p) => edit.mutate({ op: 'remove', itemId: p.itemId })} />
        <Group title="Top 40" hint="After the top 10" rows={groups.top40} canEdit={canEdit} pending={edit.isPending} top10={top10} top40={top40} onRank={rank} onAlso={(p) => edit.mutate({ op: 'rank', itemId: p.itemId, rank: null })} onRemove={(p) => edit.mutate({ op: 'remove', itemId: p.itemId })} />
        <Group title="Can make" hint="Off the shortlist" rows={groups.also} canEdit={canEdit} pending={edit.isPending} top10={top10} top40={top40} onRank={rank} onAlso={(p) => edit.mutate({ op: 'rank', itemId: p.itemId, rank: null })} onRemove={(p) => edit.mutate({ op: 'remove', itemId: p.itemId })} />
      </>
    );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (sidebar ? space.xxl : space.sm), paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl },
        ]}
      >
        {sidebar ? null : (
          <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/menus/all' as Href))} />
        )}
        <Display>Off menu</Display>
        {active && barId ? <Caption tone="muted">{active.name}</Caption> : null}
        {body}
      </ScrollView>
    </View>
  );
}

function Group({ title, hint, rows, canEdit, pending, top10, top40, onRank, onAlso, onRemove }: {
  title: string;
  hint: string;
  rows: OffMenuPick[];
  canEdit: boolean;
  pending: boolean;
  top10: number | null;
  top40: number | null;
  onRank: (pick: OffMenuPick, next: number | null) => void;
  onAlso: (pick: OffMenuPick) => void;
  onRemove: (pick: OffMenuPick) => void;
}) {
  if (!rows.length) return null;
  return (
    <View style={styles.group}>
      <Headline role="heading">{title}</Headline>
      <Caption tone="muted">{hint}</Caption>
      {rows.map((pick) => {
        const band = bandOf(pick.rank);
        return (
          <View key={pick.itemId} style={styles.pick}>
            <Body>{pick.name}</Body>
            {pick.classicName && pick.classicName !== pick.name ? <Caption tone="muted">{pick.classicName}</Caption> : null}
            {canEdit ? (
              <View role="radiogroup" aria-label={`Where ${pick.name} sits`} style={styles.bands}>
                {band === 'top10' || top10 != null ? <Chip label="Top 10" selected={band === 'top10'} onPress={() => onRank(pick, band === 'top10' ? null : top10)} /> : null}
                {band === 'top40' || top40 != null ? <Chip label="Top 40" selected={band === 'top40'} onPress={() => onRank(pick, band === 'top40' ? null : top40)} /> : null}
                <Chip label="Can make" selected={band === 'also'} onPress={() => { if (band !== 'also' && !pending) onAlso(pick); }} />
                <Button label="Remove" variant="secondary" disabled={pending} onPress={() => onRemove(pick)} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  addName: { flex: 1, gap: space.xs },
  group: { gap: space.sm },
  pick: { gap: space.xs, paddingVertical: space.sm },
  bands: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
});
