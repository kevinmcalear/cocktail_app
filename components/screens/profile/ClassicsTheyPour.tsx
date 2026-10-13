import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Body, Button, Caption, PressableScale, scoreWords, Spec, useDs } from "@/components/ds";
import { radius, space } from "@/constants/tokens";
import { useSpecMatches, type SpecMatchRow } from "@/hooks/useSpecMatches";
import { formatScore } from "@/lib/ranking";

/**
 * A profile's credited drinks split by what they are to their classic: copies
 * poured as the classic itself (the same spec, or none to tell) and the rest,
 * the profile's own drinks, riffs and variations.
 */
export function usePouredSplit<T extends { id: string }>(
  selfId: string,
  drinks: T[],
): {
  poured: T[];
  own: T[];
  matches: Record<string, SpecMatchRow> | undefined;
} {
  const { data: matches } = useSpecMatches(
    `originals:${selfId}`,
    drinks.map((d) => d.id),
  );
  const poured = drinks.filter((d) =>
    ["same", "unlisted"].includes(matches?.[d.id]?.spec_match ?? ""),
  );
  return { poured, own: drinks.filter((d) => !poured.includes(d)), matches };
}

/** How many classics show before "+5" and All. */
const FIRST = 4;

/**
 * "Classics they pour": a card of names, best scored first, each with its
 * score (b02) and opening that bar's copy where it has a page; past the first
 * few, "+5" and All (ppl-pub-bar-desktop, ppl-bar-originals). `note` says
 * where the list comes from, under the card.
 */
export function ClassicsTheyPour({
  drinks,
  scores,
  barName,
  note,
}: {
  /** A drink with no page of its own (a staff list name) has no id, and doesn't open. */
  drinks: { id: string | null; name: string }[];
  /** Scores by drink id, where people have ranked them. */
  scores?: Readonly<Record<string, number>>;
  /** Whose pours these are, for the line under them. */
  barName?: string;
  note?: string;
}) {
  const ds = useDs();
  const router = useRouter();
  const [all, setAll] = useState(false);
  if (!drinks.length) return null;
  const scoreOf = (d: { id: string | null }) => (d.id ? scores?.[d.id] : undefined);
  const sorted = [...drinks].sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
  const shown = all ? sorted : sorted.slice(0, FIRST);
  const more = sorted.length - shown.length;
  return (
    <View style={styles.section}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Classics they pour
      </Caption>
      <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
        <View role="list" style={styles.poured}>
          {shown.map((d, i) => {
            const score = scoreOf(d);
            const words = (
              <>
                <Body>{d.name}</Body>
                {score !== undefined ? <Spec tone="muted">{formatScore(score)}</Spec> : null}
              </>
            );
            return d.id ? (
              <PressableScale
                key={d.id}
                role="link"
                accessibilityLabel={[d.name, scoreWords(score)].filter(Boolean).join(", ")}
                onPress={() => router.push(`/cocktail/${d.id}` as Href)}
                style={styles.name}
              >
                {words}
              </PressableScale>
            ) : (
              <View key={`${d.name}-${i}`} role="listitem" style={styles.name}>
                {words}
              </View>
            );
          })}
          {more > 0 ? (
            <View style={styles.name}>
              <Body tone="muted">{`+${more}`}</Body>
            </View>
          ) : null}
        </View>
        {more > 0 ? <Button label="All" variant="secondary" accessibilityLabel={`All ${sorted.length} classics they pour`} onPress={() => setAll(true)} style={styles.all} /> : null}
      </View>
      <Caption tone="muted">{note ?? `The classic spec, with their bottles. Each opens ${barName ? `${barName}’s` : "their"} pour of it.`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  cap: { letterSpacing: 1.2, textTransform: "uppercase" },
  card: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: "continuous" },
  poured: { flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", columnGap: space.md + 2, rowGap: space.xs + 2 },
  name: { flexDirection: "row", alignItems: "baseline", gap: space.xs + 2, minHeight: 32 },
  all: { paddingHorizontal: space.lg },
});
