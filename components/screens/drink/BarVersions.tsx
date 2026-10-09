import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import { creditSentence, creditText, type LineageDrink } from '@/lib/lineage';
import { specNoteText, splitVersions } from '@/lib/servedAt';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;

type Version = LineageDrink & { barId?: string };
export type VersionGroups = { served: Version[]; variations: Version[]; riffs: Version[]; noteFor: (id: string) => string | null };

/**
 * A classic's bar versions, sorted by Kevin's rules (2026-10-09): the bars that
 * pour it as it is ("Served at": the same spec, or none to tell), the bars'
 * variations with what each changes, and riffs under other names. Until the
 * verdicts load, or on a server without them, every version reads as a riff,
 * as "Bars' versions" did. `classicId` null (not a classic) skips the lookup.
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

/** "Served at 12 · 30 variations · 58 riffs", leaving out the empty ones. */
export function versionCounts({ served, variations, riffs }: VersionGroups): string {
  return [
    served.length ? `Served at ${served.length}` : null,
    variations.length ? `${variations.length} variation${variations.length === 1 ? '' : 's'}` : null,
    riffs.length ? `${riffs.length} riff${riffs.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The grouped list, shown when the Backstory row opens. */
export function BarVersions({ groups }: { groups: VersionGroups }) {
  const { served, variations, riffs, noteFor } = groups;
  return (
    <>
      {served.length ? (
        <Section title="Served at">
          {served.map((v) => (
            <VersionRow key={v.id} d={v} title={v.origin_bar?.display_name ?? v.name} note={v.origin_bar?.locality ?? undefined} />
          ))}
        </Section>
      ) : null}
      {variations.length ? (
        <Section title="Variations">
          {variations.map((v) => (
            <VersionRow key={v.id} d={v} title={v.origin_bar?.display_name ?? v.name} note={noteFor(v.id) ?? 'A variation of the classic'} />
          ))}
        </Section>
      ) : null}
      {riffs.length ? (
        <Section title="Riffs">
          {riffs.map((v) => (
            <VersionRow key={v.id} d={v} title={v.name} note={creditText(creditSentence(v, null)) || v.origin || undefined} />
          ))}
        </Section>
      ) : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        {title}
      </Caption>
      <View role="list">{children}</View>
    </View>
  );
}

/** A bar's version: its bar's logo, a title and a line under it. Opens the version. */
function VersionRow({ d, title, note }: { d: LineageDrink; title: string; note?: string }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[title, note].filter(Boolean).join('. ')}
      onPress={() => router.push(drinkHref(d.id))}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      {d.origin_bar ? <UserAvatar uri={d.origin_bar.avatar_url} name={d.origin_bar.display_name} size={32} /> : null}
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1}>
          {title}
        </DsText>
        {note ? (
          <Caption tone="muted" numberOfLines={2}>
            {note}
          </Caption>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
