import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { MotiView } from "moti";
import { SectionList, StyleSheet, View } from "react-native";
import { Card, H4, Paragraph, Text, XStack, YStack, useTheme } from "tamagui";

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
    const theme = useTheme();

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
                    <Text fontSize={22} color="$color" fontWeight="bold">{title}</Text>
                </View>
            )}
            renderItem={({ item, index }) => (
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: index * 100 }}
                    style={{ marginBottom: 12 }}
                >
                    <Card
                        size="$4"
                        borderWidth={1}
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        overflow="hidden"
                        onPress={() => {
                            if (item.id.startsWith('beer-')) {
                                router.push(`/beer/${item.id.replace('beer-', '')}`);
                            } else if (item.id.startsWith('wine-')) {
                                router.push(`/wine/${item.id.replace('wine-', '')}`);
                            } else {
                                router.push(`/cocktail/${item.id}`);
                            }
                        }}
                        pressStyle={{ scale: 0.98 }}
                        elevation="$1"
                    >
                        <Card.Header flexDirection="row" padding="$3" minHeight={110} alignItems="center">
                            <YStack flex={1} paddingRight="$3" gap="$1" justifyContent="center">
                                <XStack justifyContent="space-between" alignItems="center">
                                    <H4 color="$color" fontSize={20} fontWeight="700" numberOfLines={1} flex={1} paddingRight="$2">
                                        {item.name}
                                    </H4>
                                    {item.price && <Text color="$color8" fontSize={16} fontWeight="bold">{item.price}</Text>}
                                </XStack>
                                {!!item.description && (
                                    <Paragraph color="$color11" size="$3" numberOfLines={2}>
                                        {item.description}
                                    </Paragraph>
                                )}
                                {!!item.ingredients && (
                                    <Text color="$color10" fontSize={13} fontStyle="italic" opacity={0.8} numberOfLines={1}>
                                        {item.ingredients}
                                    </Text>
                                )}
                            </YStack>

                            {item.image && (
                                <Image
                                    source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                                    style={[styles.itemImage, { backgroundColor: theme.color5?.get() as string }]}
                                    contentFit="cover"
                                    transition={500}
                                />
                            )}
                        </Card.Header>
                    </Card>
                </MotiView>
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

    itemImage: {
        width: 76,
        height: 76,
        borderRadius: 12,
    },
});
