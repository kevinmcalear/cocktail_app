import React from "react";
import { StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { ScrollView, Text, XStack, YStack, useTheme, Card } from "tamagui";
import { useRouter } from "expo-router";

import { useBars } from "@/hooks/useBars";
import { useDropdowns } from "@/hooks/useDropdowns";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassView } from "@/components/ui/GlassView";

interface BarDetailPanelProps {
    id: string;
    onMenuSelect?: (menuId: string, menuName: string) => void;
}

export function BarDetailPanel({ id, onMenuSelect }: BarDetailPanelProps) {
    const router = useRouter();
    const theme = useTheme();

    const { data: userBars, isLoading: loadingBars } = useBars();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();

    const isLoading = loadingBars || loadingDropdowns;

    if (isLoading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
                <ActivityIndicator size="large" color={theme.color8?.get() as string} />
                <Text color="$color11" marginTop="$2">Loading bar details...</Text>
            </YStack>
        );
    }

    const barMapping = userBars?.find((b: any) => b.bar_id === id);
    const bar = barMapping?.bars;
    const isGlobal = id === "global-menus";

    const barName = isGlobal 
        ? "Global Menus" 
        : (Array.isArray(bar) ? bar[0]?.name : (bar as any)?.name) || "Unknown Bar";
    const roleLevel = barMapping?.role_level || 10;

    const getRoleName = (level: number) => {
        if (level >= 40) return "Admin / Owner";
        if (level >= 30) return "Manager";
        if (level >= 20) return "Bartender";
        return "Viewer";
    };

    const barMenus = dropdowns?.menus?.filter((m: any) => isGlobal ? !m.bar_id : m.bar_id === id) || [];

    return (
        <YStack flex={1} backgroundColor="$background">
            {/* Header */}
            <XStack 
                paddingVertical="$4" 
                paddingHorizontal="$6" 
                borderBottomWidth={1} 
                borderBottomColor="$borderColor" 
                justifyContent="space-between" 
                alignItems="center"
                backgroundColor="$backgroundStrong"
            >
                <YStack flex={1} marginRight="$4">
                    <Text fontSize={24} fontWeight="bold" color="$color" numberOfLines={1}>
                        {barName}
                    </Text>
                </YStack>
                {!isGlobal && roleLevel >= 30 && (
                    <TouchableOpacity 
                        onPress={() => router.push(`/settings/bar/${id}`)} 
                        style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.05)" }]}
                    >
                        <IconSymbol name="gearshape.fill" size={16} color={theme.color?.get() as string} />
                    </TouchableOpacity>
                )}
            </XStack>

            <ScrollView flex={1} contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>
                
                {/* Bar Role Info Card */}
                {!isGlobal && (
                    <GlassView style={styles.card} intensity={10}>
                        <XStack alignItems="center" gap="$3">
                            <IconSymbol name="person.circle.fill" size={24} color={theme.color8?.get() as string} />
                            <YStack>
                                <Text fontSize={11} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>Your Access Level</Text>
                                <Text fontSize={15} fontWeight="bold" color="$color">{getRoleName(roleLevel)}</Text>
                            </YStack>
                        </XStack>
                    </GlassView>
                )}

                {/* List of Menus */}
                <YStack gap="$3">
                    <Text fontSize={14} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
                        Menus ({barMenus.length})
                    </Text>
                    
                    {barMenus.length > 0 ? (
                        <YStack gap="$2.5">
                            {barMenus.map((menu: any) => (
                                <TouchableOpacity 
                                    key={menu.id} 
                                    onPress={() => onMenuSelect?.(menu.id, menu.name)}
                                    activeOpacity={0.8}
                                >
                                    <Card
                                        padding="$3" 
                                        backgroundColor="$backgroundStrong" 
                                        borderWidth={1} 
                                        borderColor="$borderColor" 
                                        borderRadius={12}
                                        hoverStyle={{ borderColor: "$color8" }}
                                    >
                                        <XStack alignItems="center" justifyContent="space-between">
                                            <XStack alignItems="center" gap="$2.5">
                                                <IconSymbol name="folder.fill" size={18} color="#E5A93B" />
                                                <Text fontSize={14} fontWeight="600" color="$color">{menu.name}</Text>
                                            </XStack>
                                            <IconSymbol name="chevron.right" size={14} color={theme.color11?.get() as string} />
                                        </XStack>
                                    </Card>
                                </TouchableOpacity>
                            ))}
                        </YStack>
                    ) : (
                        <Card padding="$4" backgroundColor="rgba(255,255,255,0.02)" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
                            <Text color="$color11" fontStyle="italic" textAlign="center" fontSize={13}>
                                No menus in this bar.
                            </Text>
                        </Card>
                    )}
                </YStack>
            </ScrollView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    card: {
        borderRadius: 16,
        padding: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
        overflow: "hidden",
    },
});
