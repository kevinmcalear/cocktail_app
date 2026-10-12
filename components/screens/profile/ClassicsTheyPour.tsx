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
 * "Classics they pour": a line of pills, best scored first, each with its
 * score (b02) and opening that bar's copy; past the first few, "+5" and All.
 */
export function ClassicsTheyPour({
  drinks,
  scores,
  barName,
}: {
  drinks: { id: string; name: string }[];
  /** Scores by drink id, where people have ranked them. */
  scores?: Readonly<Record<string, number>>;
  /** Whose pours these are, for the line under them. */
  barName?: string;
}) {
  const ds = useDs();
  const router = useRouter();
  const [all, setAll] = useState(false);
  if (!drinks.length) return null;
  const sorted = [...drinks].sort((a, b) => (scores?.[b.id] ?? -1) - (scores?.[a.id] ?? -1));
  const shown = all ? sorted : sorted.slice(0, FIRST);
  const more = sorted.length - shown.length;
  return (
    <View style={styles.section}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Classics they pour
      </Caption>
      <View role="list" style={styles.poured}>
        {shown.map((d) => {
          const score = scores?.[d.id];
          return (
            <PressableScale
              key={d.id}
              role="link"
              accessibilityLabel={[d.name, scoreWords(score)].filter(Boolean).join(", ")}
              onPress={() => router.push(`/cocktail/${d.id}` as Href)}
              style={[styles.pill, { borderColor: ds.c.line }]}
            >
              <Body>{d.name}</Body>
              {score !== undefined ? <Spec>{formatScore(score)}</Spec> : null}
            </PressableScale>
          );
        })}
        {more > 0 ? (
          <>
            <View style={[styles.pill, { backgroundColor: ds.c.raised, borderColor: ds.c.raised }]}>
              <Caption tone="muted">{`+${more}`}</Caption>
            </View>
            <Button label="All" variant="ghost" accessibilityLabel={`All ${sorted.length} classics they pour`} onPress={() => setAll(true)} />
          </>
        ) : null}
      </View>
      <Caption tone="muted">{`The classic spec, with their bottles. Each opens ${barName ? `${barName}’s` : "their"} pour of it.`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: "uppercase" },
  poured: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
});
