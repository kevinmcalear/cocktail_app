import { CurrentMenuList } from "@/components/CurrentMenuList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ScrollView as TamaguiScrollView, Text, YStack } from "tamagui";

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const { data: dropdowns, isLoading: loadingMenus, refetch } = useDropdowns();
    const menus = dropdowns?.menus || [];

    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

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
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
            }, 500);
        }
    }, [menus, selectedMenuId]);

    const { data: menuDetails, isLoading: loadingDetails } = useMenuDetails(selectedMenuId);

    const selectedMenuName = menus.find(m => m.id === selectedMenuId)?.name || "Menu";

    return (
        <YStack flex={1} backgroundColor="$background">
            <CurrentMenuList
                sections={menuDetails?.sections || []}
                ListHeaderComponent={
                    <View>
                        <View style={{ paddingTop: insets.top + 10, alignItems: 'center', marginBottom: 10 }}>
                            <Button
                                size="$3"
                                borderRadius="$10"
                                backgroundColor={Colors.dark.tint}
                                borderColor="transparent"
                                borderWidth={1}
                                onPress={() => router.push("/tamagui-demo")}
                            >
                                <Text color="#000" fontWeight="600">
                                    ✨ View Tamagui Demo ✨
                                </Text>
                            </Button>
                        </View>
                        {loadingMenus ? (
                            <ActivityIndicator color={Colors.dark.tint} style={{ marginVertical: 20 }} />
                        ) : (
                        <TamaguiScrollView 
                                ref={scrollViewRef as any}
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 15, gap: 10, marginTop: 20, alignItems: "center" }}
                            >
                                {menus.map((menu) => {
                                    const isSelected = selectedMenuId === menu.id;
                                    return (
                                        <Button
                                            key={menu.id}
                                            size="$3"
                                            borderRadius="$10"
                                            backgroundColor={isSelected ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                            borderColor={isSelected ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                            borderWidth={1}
                                            onPress={() => setSelectedMenuId(menu.id)}
                                        >
                                            <Text color={isSelected ? "#000" : Colors.dark.text} fontWeight="600">
                                                {menu.name}
                                            </Text>
                                        </Button>
                                    );
                                })}
                                
                                <Button
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor="rgba(255,255,255,0.1)"
                                    borderStyle="dashed"
                                    borderWidth={1}
                                    borderColor="transparent"
                                    icon={<IconSymbol name="plus" size={20} color={Colors.dark.text} />}
                                    onPress={() => router.push("/menus/create")}
                                >
                                    <Text color={Colors.dark.text} fontWeight="600">
                                        Create Menu
                                    </Text>
                                </Button>
                            </TamaguiScrollView>
                        )}

                        <View style={styles.sectionHeader}>
                            {loadingDetails && <ActivityIndicator color={Colors.dark.tint} size="small" />}
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
