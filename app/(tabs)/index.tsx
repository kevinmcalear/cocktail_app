import { CurrentMenuList } from "@/components/CurrentMenuList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ScrollView as TamaguiScrollView, Text, YStack, useTheme } from "tamagui";

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    
    const { data: dropdowns, isLoading: loadingMenus, refetch } = useDropdowns();
    const menus = dropdowns?.menus || [];

    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

    // Initial selection
    useFocusEffect(
        useCallback(() => {
            refetch(); // Ensure we have the latest menus when focusing back
        }, [])
    );

    useEffect(() => {
        if (menus.length > 0 && !selectedMenuId) {
            // Select the last menu created
            const firstMenu = menus[menus.length - 1];
            setSelectedMenuId(firstMenu.id);
        }
    }, [menus, selectedMenuId]);

    const { data: menuDetails, isLoading: loadingDetails } = useMenuDetails(selectedMenuId);

    const selectedMenuName = menus.find(m => m.id === selectedMenuId)?.name || "Menu";

    return (
        <YStack flex={1} backgroundColor="$background">
            <CurrentMenuList
                sections={menuDetails?.sections || []}
                ListHeaderComponent={
                    <View style={{ paddingTop: insets.top }}>
                        {loadingMenus ? (
                            <ActivityIndicator color="$color8" style={{ marginVertical: 20 }} />
                        ) : (
                        <TamaguiScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ 
                                    paddingHorizontal: 15, 
                                    gap: 10, 
                                    marginTop: 20, 
                                    alignItems: "center",
                                    justifyContent: menus.length === 1 ? "center" : "flex-start",
                                    minWidth: '100%'
                                }}
                            >
                                {menus.length === 1 && (
                                    <View style={{ width: 44 }} /> // Balance out the "+" button so the single pill stays perfectly centered
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
                                            onPress={() => setSelectedMenuId(menu.id)}
                                        >
                                            <Text color={isSelected ? "$backgroundStrong" : "$color"} fontWeight="600">
                                                {menu.name}
                                            </Text>
                                        </Button>
                                    );
                                })}
                                
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

    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center"
    },
});
