import { CustomIcon } from "@/components/ui/CustomIcons";
import { capitalize } from "@/lib/stringUtils";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text, XStack, YStack, useTheme } from "tamagui";

export interface MenuItem {
    id: string;
    name: string;
    description: string;
    ingredients: string;
    price?: string;
    image?: any;
    recipes?: any[];
}

export interface MenuSection {
    id: string;
    title: string;
    data: MenuItem[];
}

interface CurrentMenuListProps {
    sections: MenuSection[];
    scrollEnabled?: boolean;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    onItemPress?: (item: MenuItem) => void;
    selectedItemId?: string | null;
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

type ListRow =
    | { type: "header"; id: string; label: string }
    | { type: "item"; id: string; item: MenuItem };

export function CurrentMenuList({
    sections,
    scrollEnabled = true,
    ListHeaderComponent,
    onItemPress,
    selectedItemId,
}: CurrentMenuListProps) {
    const router = useRouter();
    const theme = useTheme();

    const muted = theme.color11?.get() as string;
    const border = theme.borderColor?.get() as string;
    const highlight = "rgba(255,255,255,0.08)";

    const rows = useMemo(() => {
        const list: ListRow[] = [];
        for (const section of sections) {
            if (section.data.length === 0) continue;
            list.push({ type: "header", id: `h-${section.id}`, label: section.title });
            for (const item of section.data) {
                list.push({ type: "item", id: item.id, item });
            }
        }
        return list;
    }, [sections]);

    const openItem = (item: MenuItem) => {
        if (onItemPress) onItemPress(item);
        else router.push(openHref(item) as any);
    };

    return (
        <YStack flex={1} minHeight={0}>
            <FlatList
                data={rows}
                keyExtractor={(row) => row.id}
                scrollEnabled={scrollEnabled}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={ListHeaderComponent}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: row }) => {
                    if (row.type === "header") {
                        return (
                            <Text
                                fontSize={11}
                                fontWeight="600"
                                color="$color11"
                                letterSpacing={0.8}
                                textTransform="uppercase"
                                paddingTop={18}
                                paddingBottom={8}
                            >
                                {row.label}
                            </Text>
                        );
                    }

                    const item = row.item;
                    const isSelected = selectedItemId === item.id;
                    const title = capitalize(item.name);
                    const imageSource =
                        typeof item.image === "string" ? { uri: item.image } : item.image;

                    return (
                        <Pressable
                            onPress={() => openItem(item)}
                            accessibilityRole="button"
                            accessibilityLabel={title}
                            style={[
                                styles.row,
                                {
                                    borderBottomColor: border,
                                    backgroundColor: isSelected ? highlight : "transparent",
                                },
                            ]}
                        >
                            {item.image ? (
                                <Image
                                    source={imageSource}
                                    style={styles.thumb}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : (
                                <View
                                    style={[
                                        styles.thumb,
                                        styles.thumbPlaceholder,
                                        { backgroundColor: theme.color5?.get() as string },
                                    ]}
                                >
                                    <CustomIcon name={itemIcon(item)} size={18} color={muted} />
                                </View>
                            )}
                            <XStack flex={1} alignItems="center" justifyContent="space-between" gap="$3">
                                <Text fontSize={16} fontWeight="500" color="$color" numberOfLines={2} flex={1}>
                                    {title}
                                </Text>
                                {!!item.price && (
                                    <Text fontSize={14} color="$color11" numberOfLines={1}>
                                        {item.price}
                                    </Text>
                                )}
                            </XStack>
                        </Pressable>
                    );
                }}
            />
        </YStack>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    thumb: {
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: "rgba(127,127,127,0.15)",
    },
    thumbPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
});
