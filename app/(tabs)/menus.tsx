import { CurrentMenuList } from "@/components/CurrentMenuList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ScrollView as TamaguiScrollView, Text, YStack, XStack, useTheme } from "tamagui";
import { CocktailDetailPanel } from "@/components/CocktailDetailPanel";
import { IngredientDetailPanel } from "@/components/IngredientDetailPanel";
import { FolderTree, SelectedNode } from "@/components/FolderTree";
import { BarDetailPanel } from "@/components/BarDetailPanel";
import { MenuDetailPanel } from "@/components/MenuDetailPanel";

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const { isEditModeEnabled } = useSettingsStore();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;
    
    const { data: dropdowns, isLoading: loadingMenus, refetch } = useDropdowns();
    const menus = dropdowns?.menus || [];

    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

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

    // Auto-select first menu/bar on initial load in tree
    useEffect(() => {
        if (isLargeScreen && !selectedNode) {
            if (menus.length > 0) {
                const firstMenu = menus[menus.length - 1];
                setSelectedNode({ type: "menu", id: firstMenu.id, name: firstMenu.name });
            }
        }
    }, [menus, isLargeScreen, selectedNode]);

    const selectedMenuName = menus.find(m => m.id === selectedMenuId)?.name || "Menu";

    if (isLargeScreen) {
        return (
            <XStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top }}>
                <Stack.Screen options={{ headerShown: false }} />
                
                {/* Column 1: Folder Tree Sidebar */}
                <YStack width={320} borderRightWidth={1} borderRightColor="$borderColor" height="100%" backgroundColor="$backgroundStrong">
                    <XStack paddingHorizontal="$4" paddingVertical="$4" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$2">
                        <IconSymbol name="sidebar.left" size={16} color={theme.color8?.get() as string} />
                        <Text fontSize="$4" fontWeight="bold" color="$color">Workspace Explorer</Text>
                    </XStack>
                    <FolderTree 
                        selectedNode={selectedNode}
                        onNodeSelect={(node) => setSelectedNode(node)}
                    />
                </YStack>

                {/* Column 2: Selected Details Panel */}
                <YStack flex={1} height="100%">
                    {selectedNode?.type === "bar" && (
                        <BarDetailPanel 
                            id={selectedNode.id} 
                            onMenuSelect={(menuId, menuName) => setSelectedNode({ type: "menu", id: menuId, name: menuName })}
                        />
                    )}
                    {selectedNode?.type === "menu" && (
                        <MenuDetailPanel id={selectedNode.id} />
                    )}
                    {selectedNode?.type === "drink" && (
                        <CocktailDetailPanel id={selectedNode.id} />
                    )}
                    {selectedNode?.type === "ingredient" && (
                        <IngredientDetailPanel id={selectedNode.id} />
                    )}
                    {!selectedNode && (
                        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
                            <IconSymbol name="wineglass" size={48} color={theme.color11?.get() as string} style={{ opacity: 0.3 }} />
                            <Text color="$color11" fontSize={16} fontWeight="500" marginTop="$4">
                                Select an item from Explorer to view details.
                            </Text>
                        </YStack>
                    )}
                </YStack>
            </XStack>
        );
    }

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
                                    marginTop: 15, 
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

    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
        flexDirection: "row",
        alignItems: "center"
    },
});
