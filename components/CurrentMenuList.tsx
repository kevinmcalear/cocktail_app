import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
    allowedTypesLabel,
    itemAllowedInSection,
    normalizeAllowedTypes,
    type SectionDrinkType,
} from "@/lib/sectionAllowedTypes";
import { capitalize } from "@/lib/stringUtils";
import { useMenuEditDropStore } from "@/store/useMenuEditDropStore";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text, YStack, useTheme } from "tamagui";

export interface MenuItem {
    id: string;
    name: string;
    description: string;
    ingredients: string;
    price?: string;
    image?: any;
    recipes?: any[];
    isDraft?: boolean;
    draftProgress?: {
        percentage: number;
        color: string;
        label: string;
        badgeBg: string;
        badgeText: string;
    };
}

export interface MenuSection {
    id: string;
    title: string;
    data: MenuItem[];
    allowedTypes?: SectionDrinkType[];
}

interface CurrentMenuListProps {
    sections: MenuSection[];
    scrollEnabled?: boolean;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    onItemPress?: (item: MenuItem) => void;
    selectedItemId?: string | null;
    isEditing?: boolean;
    onRemoveItem?: (sectionId: string, itemId: string) => void;
    onAddToSection?: (sectionId: string) => void;
}

// ponytail: same breakpoints/tiles as CommandSearch
function gridColumns(width: number) {
    if (width >= 720) return 6;
    if (width >= 520) return 5;
    if (width >= 400) return 4;
    return 3;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function itemIcon(item: MenuItem) {
    if (item.id.startsWith("beer-")) return "Beer" as const;
    if (item.id.startsWith("wine-")) return "Wine" as const;
    return "TabDrinks" as const;
}

function openHref(item: MenuItem) {
    if (item.id.startsWith("beer-")) return `/beer/${item.id.replace("beer-", "")}`;
    if (item.id.startsWith("wine-")) return `/wine/${item.id.replace("wine-", "")}`;
    return `/cocktail/${item.id}`;
}

const GHOST_W = 88;

type Cell = { kind: "item"; item: MenuItem } | { kind: "add" };

type ListRow =
    | { type: "header"; id: string; label: string; sectionId: string; allowedTypes?: SectionDrinkType[] }
    | { type: "grid"; id: string; sectionId: string; cells: Cell[]; allowedTypes?: SectionDrinkType[] };

function AddDropTile({
    sectionId,
    allowedTypes,
    cellW,
    border,
    muted,
    dragItem,
    isHover,
    onPress,
}: {
    sectionId: string;
    allowedTypes: SectionDrinkType[];
    cellW: number;
    border: string;
    muted: string;
    dragItem: { id: string; category?: string | null } | null;
    isHover: boolean;
    onPress: () => void;
}) {
    const ref = useRef<View>(null);
    const setDropRect = useMenuEditDropStore((s) => s.setDropRect);
    const clearDropRect = useMenuEditDropStore((s) => s.clearDropRect);

    const measure = () => {
        ref.current?.measureInWindow((x, y, w, h) => {
            if (w > 0 && h > 0) setDropRect(sectionId, { x, y, w, h });
        });
    };

    useEffect(() => () => clearDropRect(sectionId), [sectionId, clearDropRect]);

    const dragging = !!dragItem;
    const allowed = !dragItem || itemAllowedInSection(dragItem, allowedTypes);

    return (
        <View
            ref={ref}
            onLayout={measure}
            {...(Platform.OS === "web"
                ? ({ dataSet: { menuDropSection: sectionId } } as any)
                : {})}
        >
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="Add drink"
                style={[
                    styles.card,
                    styles.addCard,
                    {
                        width: cellW,
                        borderColor: isHover ? "#6CB6FF" : border,
                        opacity: dragging && !allowed ? 0.28 : 1,
                        backgroundColor: isHover ? "rgba(108,182,255,0.12)" : "transparent",
                        transform: isHover ? [{ scale: 1.04 }] : undefined,
                    },
                ]}
            >
                <YStack
                    width="100%"
                    aspectRatio={1}
                    alignItems="center"
                    justifyContent="center"
                    gap={6}
                >
                    <IconSymbol name="plus" size={22} color={isHover ? "#6CB6FF" : muted} />
                    <Text fontSize={11} fontWeight="600" color={isHover ? "#6CB6FF" : "$color11"}>
                        Add
                    </Text>
                </YStack>
            </Pressable>
        </View>
    );
}

export function CurrentMenuList({
    sections,
    scrollEnabled = true,
    ListHeaderComponent,
    onItemPress,
    selectedItemId,
    isEditing,
    onRemoveItem,
    onAddToSection,
}: CurrentMenuListProps) {
    const router = useRouter();
    const theme = useTheme();
    const [panelWidth, setPanelWidth] = useState(0);
    const drag = useMenuEditDropStore((s) => s.drag);

    const muted = theme.color11?.get() as string;
    const border = theme.borderColor?.get() as string;
    const surface = theme.color4?.get() as string;
    const highlight = "rgba(255,255,255,0.1)";

    const gap = 6;
    const padH = 15;
    const cols = gridColumns(panelWidth || 400);
    const cellW =
        panelWidth > 0 ? (panelWidth - padH * 2 - gap * (cols - 1)) / cols : 72;

    const rows = useMemo(() => {
        const list: ListRow[] = [];
        for (const section of sections) {
            if (section.data.length === 0 && !isEditing) continue;
            const allowedTypes = normalizeAllowedTypes(section.allowedTypes);
            list.push({
                type: "header",
                id: `h-${section.id}`,
                label: section.title,
                sectionId: section.id,
                allowedTypes,
            });
            const cells: Cell[] = section.data.map((item) => ({ kind: "item", item }));
            if (isEditing && onAddToSection) cells.push({ kind: "add" });
            chunk(cells, cols).forEach((group, i) => {
                list.push({
                    type: "grid",
                    id: `${section.id}-row-${i}`,
                    sectionId: section.id,
                    cells: group,
                    allowedTypes,
                });
            });
        }
        return list;
    }, [sections, cols, isEditing, onAddToSection]);

    const openItem = (item: MenuItem) => {
        // ponytail: edit mode still opens drinks when parent wires onItemPress (Creator Hub stack)
        if (onItemPress) {
            onItemPress(item);
            return;
        }
        if (isEditing) return;
        router.push(openHref(item) as any);
    };

    const ghostImage =
        drag?.item.image?.uri ||
        drag?.item.item_images?.[0]?.images?.url ||
        (typeof drag?.item.image === "string" ? drag.item.image : null);

    return (
        <YStack
            flex={1}
            minHeight={0}
            onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setPanelWidth((prev) => (prev === w ? prev : w));
            }}
        >
            <FlatList
                data={rows}
                keyExtractor={(row) => row.id}
                scrollEnabled={scrollEnabled && !drag}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={ListHeaderComponent}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: row }) => {
                    if (row.type === "header") {
                        const typesLabel = row.allowedTypes?.length
                            ? allowedTypesLabel(row.allowedTypes)
                            : null;
                        return (
                            <YStack paddingHorizontal={padH} paddingTop={18} paddingBottom={10} gap={2}>
                                <Text
                                    fontSize={10}
                                    fontWeight="600"
                                    color="$color11"
                                    letterSpacing={0.8}
                                    textTransform="uppercase"
                                >
                                    {row.label}
                                </Text>
                                {typesLabel ? (
                                    <Text fontSize={11} color="$color10">
                                        {typesLabel}
                                    </Text>
                                ) : null}
                            </YStack>
                        );
                    }

                    const allowedTypes = row.allowedTypes || normalizeAllowedTypes(null);
                    const isHover = drag?.hoverSectionId === row.sectionId;

                    return (
                        <View style={[styles.gridRow, { gap, paddingHorizontal: padH }]}>
                            {row.cells.map((cell) => {
                                if (cell.kind === "add") {
                                    return (
                                        <AddDropTile
                                            key={`add-${row.sectionId}`}
                                            sectionId={row.sectionId}
                                            allowedTypes={allowedTypes}
                                            cellW={cellW}
                                            border={border}
                                            muted={muted}
                                            dragItem={drag?.item ?? null}
                                            isHover={isHover}
                                            onPress={() => onAddToSection?.(row.sectionId)}
                                        />
                                    );
                                }

                                const item = cell.item;
                                const isSelected = selectedItemId === item.id;
                                const title = capitalize(item.name);
                                const imageSource =
                                    typeof item.image === "string" ? { uri: item.image } : item.image;
                                const hasImage = !!item.image;

                                return (
                                    <Pressable
                                        key={item.id}
                                        onPress={() => openItem(item)}
                                        accessibilityRole="button"
                                        accessibilityLabel={title}
                                        style={[
                                            styles.card,
                                            {
                                                width: cellW,
                                                borderColor: isSelected ? muted : border,
                                                backgroundColor: isSelected
                                                    ? highlight
                                                    : surface || "rgba(255,255,255,0.04)",
                                            },
                                        ]}
                                    >
                                        {isEditing && onRemoveItem ? (
                                            <Pressable
                                                onPress={() => onRemoveItem(row.sectionId, item.id)}
                                                style={styles.removeBtn}
                                                hitSlop={6}
                                            >
                                                <IconSymbol name="xmark" size={10} color="#fff" />
                                            </Pressable>
                                        ) : null}
                                        {item.isDraft && item.draftProgress ? (
                                            <View
                                                style={[
                                                    styles.progressBadge,
                                                    {
                                                        backgroundColor: item.draftProgress.badgeBg,
                                                        borderColor: item.draftProgress.color,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    fontSize={8}
                                                    fontWeight="bold"
                                                    color={item.draftProgress.badgeText}
                                                >
                                                    {item.draftProgress.percentage}%
                                                </Text>
                                            </View>
                                        ) : null}
                                        {hasImage ? (
                                            <Image
                                                source={imageSource}
                                                style={styles.cardImage}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                        ) : (
                                            <YStack
                                                width="100%"
                                                aspectRatio={1}
                                                alignItems="center"
                                                justifyContent="center"
                                                backgroundColor="$color5"
                                                gap={4}
                                                padding={4}
                                            >
                                                <CustomIcon name={itemIcon(item)} size={18} color={muted} />
                                                <Text
                                                    fontSize={10}
                                                    fontWeight="600"
                                                    color="$color"
                                                    numberOfLines={2}
                                                    textAlign="center"
                                                >
                                                    {title}
                                                </Text>
                                            </YStack>
                                        )}
                                        {hasImage ? (
                                            <YStack paddingHorizontal={5} paddingVertical={5} gap={1}>
                                                <Text fontSize={10} fontWeight="600" color="$color" numberOfLines={2}>
                                                    {title}
                                                </Text>
                                                {!!item.price && (
                                                    <Text fontSize={9} color="$color11" numberOfLines={1}>
                                                        {item.price}
                                                    </Text>
                                                )}
                                            </YStack>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    );
                }}
            />

            {drag ? (
                <View
                    pointerEvents="none"
                    {...(Platform.OS === "web"
                        ? ({ dataSet: { menuDragGhost: "1" } } as any)
                        : {})}
                    style={[
                        styles.ghost,
                        Platform.OS === "web"
                            ? ({ position: "fixed" } as any)
                            : styles.ghostAbsolute,
                        {
                            left: drag.x - GHOST_W / 2,
                            top: drag.y - GHOST_W / 2,
                            width: GHOST_W,
                            borderColor: drag.hoverSectionId ? "#6CB6FF" : border,
                            backgroundColor: surface || "rgba(30,30,30,0.95)",
                        },
                    ]}
                >
                    {ghostImage ? (
                        <Image
                            source={{ uri: ghostImage }}
                            style={styles.ghostImage}
                            contentFit="cover"
                        />
                    ) : (
                        <YStack flex={1} alignItems="center" justifyContent="center" padding={6} gap={4}>
                            <CustomIcon
                                name={
                                    drag.item.id.startsWith("beer-") || drag.item.category === "Beer"
                                        ? "Beer"
                                        : drag.item.id.startsWith("wine-") || drag.item.category === "Wine"
                                          ? "Wine"
                                          : "TabDrinks"
                                }
                                size={20}
                                color={muted}
                            />
                            <Text fontSize={10} fontWeight="600" color="$color" numberOfLines={2} textAlign="center">
                                {capitalize(drag.item.name)}
                            </Text>
                        </YStack>
                    )}
                    {ghostImage ? (
                        <YStack paddingHorizontal={5} paddingVertical={4}>
                            <Text fontSize={10} fontWeight="600" color="$color" numberOfLines={2}>
                                {capitalize(drag.item.name)}
                            </Text>
                        </YStack>
                    ) : null}
                </View>
            ) : null}
        </YStack>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingBottom: 120,
    },
    gridRow: {
        flexDirection: "row",
        flexWrap: "nowrap",
        marginBottom: 6,
    },
    card: {
        borderRadius: 8,
        borderWidth: 1,
        overflow: "hidden",
    },
    addCard: {
        borderStyle: "dashed",
        backgroundColor: "transparent",
        justifyContent: "center",
    },
    cardImage: {
        width: "100%",
        aspectRatio: 1,
        backgroundColor: "rgba(127,127,127,0.15)",
    },
    removeBtn: {
        position: "absolute",
        top: 4,
        right: 4,
        zIndex: 2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
    },
    progressBadge: {
        position: "absolute",
        top: 4,
        left: 4,
        zIndex: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
    },
    ghost: {
        zIndex: 1000,
        borderRadius: 8,
        borderWidth: 1,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        opacity: 0.95,
    } as any,
    ghostAbsolute: {
        position: "absolute",
    },
    ghostImage: {
        width: "100%",
        aspectRatio: 1,
        backgroundColor: "rgba(127,127,127,0.15)",
    },
});
