import { Fragment, useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import {
  Caption,
  Display,
  DsText,
  GlassButton,
  PressableScale,
  Tag,
  useDs,
  useGutter,
  type TagTone,
} from "@/components/ds";
import { Crumbs, type Crumb } from "@/components/nav/PageFrame";
import { displayFaces, font, layout, radius, space } from "@/constants/tokens";
import { useWebNav, WEB_RAIL_WIDTH, WEB_SIDEBAR_WIDTH } from "@/hooks/useIsWideWeb";

import { MenuSky, MenuTrio } from "../page/MenuBandLazy";
import type { MenuInk } from "../page/MenuDrawing";

const TONE: Record<"green" | "amber" | "quiet", TagTone> = {
  green: "success",
  amber: "warning",
  quiet: "default",
};
const SKY_H = 360;
/** The menu's margins on the board (Menu-l-desk: 72 left, 56 right of the 960 beside the pane). */
const DESK_PAD = { left: space.xxxl + space.xl, right: space.xxxl + space.sm };
/** Two columns of rows once each can be about as wide as the board's (Menu-desk: two of about 390). */
const TWO_COLUMNS = 2 * layout.menuColumnMin + space.xxxl;

/**
 * The menu's column on the desktop (Menu-desk, Menu-l-desk): it fills the
 * window between the side nav and the drink or the swap beside it, with the
 * board's margins once there's the board's room, the page's gutter before.
 */
export function useDeskColumn() {
  const { width } = useWindowDimensions();
  const nav = useWebNav();
  const gutter = useGutter();
  const room = width - (nav === "sidebar" ? WEB_SIDEBAR_WIDTH : WEB_RAIL_WIDTH) - layout.menuPaneDesk;
  const board = room >= 900;
  return { paddingLeft: board ? DESK_PAD.left : gutter, paddingRight: board ? DESK_PAD.right : gutter, width: "100%" } as const;
}

interface DeskHeadProps {
  crumb: Crumb;
  heroIds: string[];
  ink: MenuInk;
  quiet: boolean;
  tag: { label: string; tone: "green" | "amber" | "quiet" } | null;
  eyebrow: string;
  name: string;
  description: string | null;
  /** The pills at the top right: Share, and Edit for the menu team. */
  pills: { label: string; onPress: () => void; ink?: boolean }[];
  /** A home menu's …, before its Share (Menu-h-page): Edit and the rest are in its sheet. */
  onMore?: () => void;
}

/**
 * The top of a menu on the desktop (Menu-desk): the crumb and the pills on
 * one line, the name on the left with the drinks drawn at the top right, all
 * on the menu's sky.
 */
export function MenuDeskHead({
  crumb,
  heroIds,
  ink,
  quiet,
  tag,
  eyebrow,
  name,
  description,
  pills,
  onMore,
}: DeskHeadProps) {
  const ds = useDs();
  // The sky runs out to the column's edges.
  const pad = useDeskColumn();
  return (
    <View>
      {quiet || !heroIds.length ? null : (
        <View
          style={[styles.sky, { left: -pad.paddingLeft, right: -pad.paddingRight }]}
          pointerEvents="none"
        >
          <MenuSky ids={heroIds} fade />
        </View>
      )}
      <View style={styles.bar}>
        <Crumbs trail={[crumb]} />
        <View style={styles.pills}>
          {onMore ? <GlassButton icon="ellipsis" accessibilityLabel="More" onPress={onMore} /> : null}
          {pills.map((p) => (
            <PressableScale
              key={p.label}
              role="button"
              accessibilityLabel={p.label}
              onPress={p.onPress}
              style={[
                styles.pill,
                p.ink
                  ? { backgroundColor: ds.c.ink }
                  : { backgroundColor: ds.c.raised, borderColor: ds.c.line },
              ]}
            >
              <DsText
                variant="label"
                color={p.ink ? ds.c.ground : ds.c.ink}
                style={font.semiBold}
              >
                {p.label}
              </DsText>
            </PressableScale>
          ))}
        </View>
      </View>
      <View style={styles.top}>
        <View style={styles.title}>
          <View style={styles.eyebrowRow}>
            {tag ? <Tag label={tag.label} tone={TONE[tag.tone]} /> : null}
            <Caption tone="muted" style={styles.caps} numberOfLines={2}>
              {eyebrow.toUpperCase()}
            </Caption>
          </View>
          <Display>{name}</Display>
          {description ? (
            <DsText
              variant="headline"
              tone="muted"
              style={[
                font.regular,
                { fontFamily: displayFaces[ds.displayFace].italic },
              ]}
            >
              {description}
            </DsText>
          ) : null}
        </View>
        {heroIds.length ? (
          <View style={styles.trio} aria-hidden>
            <MenuTrio ids={heroIds} ink={ink} layout="band" top={0} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The menu's sections side by side on the desktop (Menu-desk: Stirred beside
 * Shaken), each section's rows under its head, in the page's order. A menu of
 * one section runs its rows down both columns under one head, so the rows
 * keep the board's width; a column too narrow for two shows one.
 */
export function MenuDeskColumns<T extends { key: string; head?: unknown }>({
  items,
  render,
}: {
  items: T[];
  render: (item: T) => ReactNode;
}) {
  const [width, setWidth] = useState<number | null>(null); // one column until measured
  const groups: T[][] = [];
  for (const item of items) {
    if (item.head || !groups.length) groups.push([]);
    groups[groups.length - 1].push(item);
  }
  let top: T[] = [];
  let columns: T[][];
  if (width === null || width < TWO_COLUMNS) columns = [items];
  else if (groups.length === 1) {
    top = groups[0][0]?.head ? [groups[0][0]] : [];
    const rows = groups[0].slice(top.length);
    const half = Math.ceil(rows.length / 2);
    columns = [rows.slice(0, half), rows.slice(half)];
  } else {
    // ponytail: sections alternate between the two columns, as the board lays out two; a long first section can leave the right one short. Upgrade: balance by row count.
    columns = [groups.filter((_, i) => i % 2 === 0).flat(), groups.filter((_, i) => i % 2 === 1).flat()];
  }
  const each = (item: T) => <Fragment key={item.key}>{render(item)}</Fragment>;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {top.map(each)}
      <View style={styles.columns}>
        {columns.map((col, c) => (
          <View key={c} style={styles.column}>
            {col.map(each)}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { position: "absolute", top: 0, height: SKY_H },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 76,
  },
  pills: { flexDirection: "row", gap: space.sm },
  pill: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  top: { flexDirection: "row", alignItems: "flex-end", gap: space.xl },
  title: { flex: 1, gap: space.xs, paddingBottom: space.lg },
  trio: { width: 300, height: 200, justifyContent: "flex-end" },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexWrap: "wrap",
  },
  caps: { letterSpacing: 1.2, flexShrink: 1, ...font.medium },
  columns: { flexDirection: "row", gap: space.xxxl },
  column: { flex: 1, minWidth: 0 },
});
