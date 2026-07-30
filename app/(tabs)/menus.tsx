import { CurrentMenuList } from "@/components/CurrentMenuList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useAppStore } from "@/store/useAppStore";
import { useRecentActivityStore } from "@/store/useRecentActivityStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ScrollView as TamaguiScrollView, Text, YStack, useTheme } from "tamagui";

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const { isEditModeEnabled } = useSettingsStore();
    const selectedMenuId = useAppStore((s) => s.selectedMenuId);
    const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);
    const pushRecent = useRecentActivityStore((s) => s.push);

    const { data: dropdowns, isLoading: loadingMenus, refetch } = useDropdowns();
    const menus = dropdowns?.menus || [];

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    useEffect(() => {
        if (menus.length === 0) return;
        const stillValid = selectedMenuId && menus.some((m) => m.id === selectedMenuId);
        if (!stillValid) {
            setSelectedMenuId(menus[menus.length - 1].id);
        }
    }, [menus, selectedMenuId, setSelectedMenuId]);

    const selectMenu = (menu: { id: string; name: string; bar_id?: string | null; cover_url?: string | null }) => {
        setSelectedMenuId(menu.id);
        pushRecent({
            id: menu.id,
            kind: 'menu',
            title: menu.name,
            subtitle: 'Menu',
            href: '/(tabs)/menus',
            barId: menu.bar_id ?? null,
            imageUrl: menu.cover_url ?? null,
        });
    };

    const { data: menuDetails, isLoading: loadingDetails } = useMenuDetails(selectedMenuId);
    const selectedCoverUrl = menus.find((m) => m.id === selectedMenuId)?.cover_url ?? null;

    return (
        <YStack flex={1} backgroundColor="$background">
            <CurrentMenuList
                sections={menuDetails?.sections || []}
                ListHeaderComponent={
                    <View style={{ paddingTop: insets.top }}>
                        {selectedCoverUrl ? (
                            <Image
                                source={{ uri: selectedCoverUrl }}
                                style={styles.cover}
                                contentFit="cover"
                            />
                        ) : null}
                        {loadingMenus ? (
                            <ActivityIndicator color="$color8" style={{ marginVertical: 20 }} />
                        ) : (
                        <TamaguiScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ 
                                    paddingHorizontal: 15, 
                                    gap: 10, 
                                    marginTop: 15, 
                                    alignItems: "center",
                                    justifyContent: menus.length === 1 ? "center" : "flex-start",
                                    minWidth: '100%'
                                }}
                            >
                                {menus.length === 1 && (
                                    <View style={{ width: 44 }} />
                                )}
                                {menus.map((menu) => {
                                    const isSelected = selectedMenuId === menu.id;
                                    return (
                                        <Button
                                            key={menu.id}
                                            size="$3"
                                            borderRadius="$10"
                                            backgroundColor={isSelected ? "$color8" : "$backgroundStrong"}
                                            borderColor={isSelected ? "$color8" : "$borderColor"}
                                            borderWidth={1}
                                            onPress={() => selectMenu(menu)}
                                        >
                                            <Text color={isSelected ? "$backgroundStrong" : "$color"} fontWeight="600">
                                                {menu.name}
                                            </Text>
                                        </Button>
                                    );
                                })}
                                
                                {isEditModeEnabled && (
                                    <Button
                                        size="$3"
                                        circular
                                        backgroundColor="$backgroundStrong"
                                        borderStyle="dashed"
                                        borderWidth={1}
                                        borderColor="$borderColor"
                                        icon={<IconSymbol name="plus" size={16} color={theme.color?.get() as string} />}
                                        onPress={() => router.push("/menus/create")}
                                    />
                                )}
                            </TamaguiScrollView>
                        )}

                        <View style={styles.sectionHeader}>
                            {loadingDetails && <ActivityIndicator color="$color8" size="small" />}
                        </View>
                    </View>
                }
            />
        </YStack>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    cover: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#222',
    },
    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
        flexDirection: "row",
        alignItems: "center"
    },
});
