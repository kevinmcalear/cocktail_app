import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, TextLink, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { useItemScores } from '@/hooks/useFlavor';
import { useLineage } from '@/hooks/useLineage';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import type { LineageDrink } from '@/lib/lineage';
import { specNoteText, splitVersions } from '@/lib/servedAt';

import { Score } from './Score';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;
/** Bar tiles shown before "+N more". */
const SHOWN = 4;

type Version = LineageDrink & { barId?: string };
export type VersionGroups = { served: Version[]; variations: Version[]; riffs: Version[]; noteFor: (id: string) => string | null };

/**
 * A classic's bar versions, sorted by Kevin's rules (2026-10-09): the bars that
 * pour it as it is ("Served at": the same spec, or none to tell), the bars'
 * variations with what each changes, and riffs under other names. Until the
 * verdicts load, or on a server without them, every version reads as a riff.
 * `classicId` null (not a classic) skips the lookup.
 */
export function useVersionGroups(classicId: string | null, versions: LineageDrink[]): VersionGroups {
  const { data: matches } = useSpecMatches(classicId ?? undefined, classicId ? versions.map((v) => v.id) : []);
  // One row per bar for the classic itself: a bar with two copies is still one place.
  const groups = splitVersions(
    versions.map((v) => ({ ...v, barId: v.origin_bar?.id })),
    (id) => matches?.[id]?.spec_match
  );
  return { ...groups, noteFor: (id) => specNoteText(matches?.[id]?.notes) ?? null };
}

/** Best score first; unscored after, in the order they came. */
export function byScore<T extends { id: string }>(list: T[], scores: Record<string, number>): T[] {
  return list.map((v, i) => ({ v, i })).sort((a, b) => (scores[b.v.id] ?? -1) - (scores[a.v.id] ?? -1) || a.i - b.i).map((x) => x.v);
}

/**
 * Under a classic's spec (board drink-phone-classic): the bars that pour the
 * exact spec as a strip of their logos with each one's score for it, best
 * first, then its variations with what each changes and its score. Nothing
 * for a drink that isn't a catalog classic, or has no bar versions.
 */
export function ServedAt({ itemId }: { itemId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data } = useLineage(itemId);
  const classic = data?.drink?.is_catalog ? data.drink : null;
  const groups = useVersionGroups(classic?.id ?? null, classic ? data!.riffs : []);
  const { data: scores = {} } = useItemScores([...groups.served, ...groups.variations].map((v) => v.id));
  const [all, setAll] = useState(false);
  if (!classic || (!groups.served.length && !groups.variations.length)) return null;
  const served = byScore(groups.served, scores);
  const shown = all ? served : served.slice(0, SHOWN);
  const rest = served.length - shown.length;

  return (
    <>
      {served.length ? (
        <View style={styles.section}>
          <View style={styles.head}>
            <Caption tone="muted" role="heading" style={styles.cap}>{`SERVED AT ${served.length} BAR${served.length === 1 ? '' : 'S'}`}</Caption>
            {served.length > SHOWN ? <TextLink label={all ? 'Fewer' : 'All ›'} onPress={() => setAll(!all)} /> : null}
          </View>
          <ScrollView horizontal={!all} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.strip, all && styles.wrap]}>
            {shown.map((v) => (
              <PressableScale
                key={v.id}
                role="link"
                accessibilityLabel={[v.origin_bar?.display_name ?? v.name, v.origin_bar?.locality, scores[v.id] != null ? String(scores[v.id]) : 'no score'].filter(Boolean).join(', ')}
                onPress={() => router.push(drinkHref(v.id))}
                style={styles.tile}
              >
                <UserAvatar uri={v.origin_bar?.avatar_url ?? null} name={v.origin_bar?.display_name ?? v.name} size={48} />
                <DsText variant="caption" numberOfLines={2} style={styles.tileName}>
                  {v.origin_bar?.display_name ?? v.name}
                </DsText>
                <Score score={scores[v.id]} hideEmpty />
              </PressableScale>
            ))}
            {rest > 0 ? (
              <PressableScale role="button" accessibilityLabel={`${rest} more bars`} onPress={() => setAll(true)} style={styles.tile}>
                <View style={[styles.more, { borderColor: ds.c.lineStrong }]}>
                  <DsText variant="headline">+</DsText>
                </View>
                <DsText variant="caption" style={styles.tileName}>{`${rest} more`}</DsText>
              </PressableScale>
            ) : null}
          </ScrollView>
          <Caption tone="muted">{"The exact spec, with each bar's bottles. Their score for this drink, best first."}</Caption>
        </View>
      ) : null}
      {groups.variations.length ? (
        <View style={styles.section}>
          <Caption tone="muted" role="heading" style={styles.cap}>{`VARIATIONS ${groups.variations.length}`}</Caption>
          <View role="list">
            {byScore(groups.variations, scores).map((v) => {
              const note = groups.noteFor(v.id) ?? 'A variation of the classic';
              const title = v.origin_bar?.display_name ?? v.name;
              return (
                <PressableScale key={v.id} role="link" accessibilityLabel={`${title}. ${note}. ${scores[v.id] != null ? `Score ${scores[v.id]}` : 'No score'}`} onPress={() => router.push(drinkHref(v.id))} style={[styles.row, { borderBottomColor: ds.c.line }]}>
                  {v.origin_bar ? <UserAvatar uri={v.origin_bar.avatar_url} name={v.origin_bar.display_name} size={32} /> : null}
                  <View style={styles.flex}>
                    <DsText variant="headline" numberOfLines={1}>
                      {title}
                    </DsText>
                    <Caption tone="muted" numberOfLines={2}>
                      {note}
                    </Caption>
                  </View>
                  <Score score={scores[v.id]} />
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cap: { letterSpacing: 1.2 },
  strip: { gap: space.sm, paddingVertical: space.xs },
  wrap: { flexWrap: 'wrap' },
  // The board's strip: round bar logos, the name and its score under each, no box.
  tile: { width: 76, alignItems: 'center', gap: space.xs },
  tileName: { textAlign: 'center' },
  more: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
