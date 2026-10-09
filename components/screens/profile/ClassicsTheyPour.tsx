import { useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Body, Caption, PressableScale, useDs } from "@/components/ds";
import { radius, space } from "@/constants/tokens";
import { useSpecMatches, type SpecMatchRow } from "@/hooks/useSpecMatches";

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

/** "Classics they pour": one line of names, each opening that bar's copy. */
export function ClassicsTheyPour({
  drinks,
}: {
  drinks: { id: string; name: string }[];
}) {
  const ds = useDs();
  const router = useRouter();
  if (!drinks.length) return null;
  return (
    <View style={styles.section}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Classics they pour
      </Caption>
      <View role="list" style={styles.poured}>
        {drinks.map((d) => (
          <PressableScale
            key={d.id}
            role="link"
            accessibilityLabel={d.name}
            onPress={() => router.push(`/cocktail/${d.id}` as Href)}
            style={[styles.pill, { borderColor: ds.c.line }]}
          >
            <Body>{d.name}</Body>
          </PressableScale>
        ))}
      </View>
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
    justifyContent: "center",
  },
});
