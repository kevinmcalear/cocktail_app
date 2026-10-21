import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  Body,
  Caption,
  DrinkImage,
  PressableScale,
  TextLink,
  useDs,
} from "@/components/ds";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { layout, radius, space } from "@/constants/tokens";
import type { Original } from "@/hooks/useProfiles";
import { heroPicture } from "@/lib/itemImages";
import { creators, joinNames, type CreditProfile } from "@/lib/lineage";
import { usePrefetchCocktail } from "@/hooks/useCocktails";

import { usePouredSplit } from "./ClassicsTheyPour";
import { CreditLinks } from "./CreditLinks";

/** Rows shown before "All 12 originals" (ppl-bar-unclaimed draws three, then the lock). */
const FIRST = 3;

/**
 * A bar's drinks when its page keeps the specs back: each name, and (unless
 * the page is locked) its picture, who made it and what it's like, with a
 * lock where the spec would be. Each row still opens the drink, to rank or save it.
 * Only its own drinks: copies of a classic aren't listed while the specs are
 * kept back (ppl-bar-unclaimed). Three, then "All N originals".
 */
export function LockedOriginals({
  originals,
  selfId,
  details,
  emptyText,
  runs,
  quiet = false,
}: {
  originals: Original[];
  selfId: string;
  details: boolean;
  emptyText: string;
  /** "on now" or "Past · 2024 to 2025" by drink id (drinkRunTags). */
  runs?: Readonly<Record<string, string>>;
  /** No lock on each row (the page says once why its specs are kept), and short descriptions: the public page (ppl-pub-bar-desktop). */
  quiet?: boolean;
}) {
  const [all, setAll] = useState(false);
  const { own } = usePouredSplit(selfId, originals);
  if (!own.length) return <Body tone="muted">{emptyText}</Body>;
  return (
    <View style={styles.block}>
      <View role="list">
        {(all ? own : own.slice(0, FIRST)).map((d) => (
          <LockedRow key={d.id} drink={d} people={creators(d).filter((p) => p.id !== selfId)} after={runs?.[d.id] ?? (d.origin_year ? String(d.origin_year) : null)} details={details} quiet={quiet} />
        ))}
      </View>
      {own.length > FIRST && !all ? (
        <View style={styles.start}>
          <TextLink label={`All ${own.length} originals`} onPress={() => setAll(true)} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One drink whose spec the page keeps back: its picture, its name, who made
 * it (each a link to their page), what it's like, and a lock. It opens the
 * drink, to rank or save it. A drink known only by name shows just that.
 */
export function LockedRow({
  drink: d,
  people,
  after,
  details,
  quiet = false,
}: {
  drink: Pick<Original, 'id' | 'name'> & Partial<Pick<Original, 'description' | 'item_images' | 'glass'>>;
  people: readonly CreditProfile[];
  /** After the makers: "on now", the year, "on the last menu too". */
  after?: string | null;
  details: boolean;
  quiet?: boolean;
}) {
  const ds = useDs();
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const by = details && people.length ? `by ${joinNames(people.map((p) => p.display_name))}` : null;
  const meta = details ? [by, after].filter(Boolean).join(" · ") : "";
  const description = details ? d.description : null;
  const hero = details ? heroPicture(d.item_images ?? null) : null;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[d.name, meta, description, "Spec private"].filter(Boolean).join(". ")}
      onPressIn={() => prefetch(d.id, { name: d.name, item_images: d.item_images ?? null })}
      onPress={() => router.push(`/cocktail/${d.id}` as Href)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      {details ? (
        <View style={styles.thumb}>
          <DrinkImage thumb sketchDetail="thumb" source={hero?.url} generated={hero?.isSketch} glass={d.glass?.icon_key} itemId={d.id} accessibilityLabel={d.name} radius="control" />
        </View>
      ) : null}
      <View style={styles.text}>
        <Body>{d.name}</Body>
        {details ? <CreditLinks people={people} after={after} /> : null}
        {description ? (
          <Caption tone="muted" numberOfLines={2} style={styles.description}>
            {description}
          </Caption>
        ) : null}
      </View>
      {quiet ? null : (
        <View style={[styles.lock, { backgroundColor: ds.c.raised }]} aria-hidden>
          <IconSymbol name="lock.fill" size={18} color={ds.c.muted} />
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  start: { alignSelf: "flex-start" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 52 },
  text: { flex: 1, minWidth: 0, gap: space.xs / 2 },
  description: { marginTop: space.xs },
  lock: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: radius.control,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
});
