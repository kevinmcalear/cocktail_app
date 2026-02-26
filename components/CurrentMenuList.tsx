import { ThemedText } from "@/components/themed-text";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SectionList, StyleSheet, TouchableOpacity, View } from "react-native";

export interface MenuItem {
    id: string;
    name: string;
    description: string;
    ingredients: string;
    price?: string;
    image?: any;
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
}

export function CurrentMenuList({ sections, scrollEnabled = true, ListHeaderComponent }: CurrentMenuListProps) {
    const router = useRouter();

    return (
        <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={ListHeaderComponent}
            renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeaderContainer}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>{title}</ThemedText>
                </View>
            )}
            renderItem={({ item }) => (
                <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/cocktail/${item.id}`)}>
                    <GlassView style={styles.itemCard} intensity={20}>
                        <View style={styles.itemRow}>
                            <View style={styles.textContainer}>
                                <View style={styles.titleRow}>
                                    <ThemedText type="subtitle" style={styles.itemName} numberOfLines={1}>{item.name}</ThemedText>
                                    {item.price && <ThemedText style={styles.itemPrice}>{item.price}</ThemedText>}
                                </View>
                                {!!item.description && (
                                    <ThemedText style={styles.itemDescription} numberOfLines={2}>
                                        {item.description}
                                    </ThemedText>
                                )}
                                {!!item.ingredients && (
                                    <ThemedText style={styles.itemIngredients} numberOfLines={1}>
                                        {item.ingredients}
                                    </ThemedText>
                                )}
                            </View>
                            {item.image && (
                                <Image
                                    source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                                    style={styles.itemImage}
                                    contentFit="cover"
                                    transition={500}
                                />
                            )}
                        </View>
                    </GlassView>
                </TouchableOpacity>
            )}
        />
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: 15,
        paddingBottom: 120, // Keep padding for bottom nav
        paddingTop: 10,
    },
    sectionHeaderContainer: {
        paddingVertical: 12,
        paddingHorizontal: 5,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 22,
        color: Colors.dark.text,
        fontWeight: "bold",
    },
    itemCard: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        height: 110,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 12,
        gap: 4,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemName: {
        fontSize: 20,
        fontWeight: "700",
        color: Colors.dark.text,
        flex: 1, 
        marginRight: 8
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.dark.tint,
    },
    itemDescription: {
        fontSize: 15,
        color: Colors.dark.icon,
        lineHeight: 20,
    },
    itemIngredients: {
        fontSize: 13,
        color: Colors.dark.icon,
        fontStyle: 'italic',
        opacity: 0.8
    },
    itemImage: {
        width: 76,
        height: 76,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
    },
});
