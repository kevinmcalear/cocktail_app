import React from "react";
import { StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { ScrollView, Text, XStack, YStack, useTheme, Card, Paragraph, H4 } from "tamagui";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useBars } from "@/hooks/useBars";
import { useAppStore } from "@/store/useAppStore";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface MenuDetailPanelProps {
    id: string;
}

export function MenuDetailPanel({ id }: MenuDetailPanelProps) {
    const router = useRouter();
    const theme = useTheme();
    const { isEditModeEnabled } = useSettingsStore();

    const selectedBarId = useAppStore((state) => state.selectedBarId);
    const { data: bars } = useBars();
    const currentBarRole = bars?.find((b) => b.bar_id === selectedBarId)?.role_level || 10;
    const canEdit = currentBarRole > 30;

    const { data: menuDetails, isLoading, error } = useMenuDetails(id);

    if (isLoading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
                <ActivityIndicator size="large" color={theme.color8?.get() as string} />
                <Text color="$color11" marginTop="$2">Loading menu details...</Text>
            </YStack>
        );
    }

    if (error || !menuDetails) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor="$background">
                <IconSymbol name="exclamationmark.triangle.fill" size={32} color="$red10" style={{ opacity: 0.5 }} />
                <Text color="$color11" marginTop="$2">Failed to load menu details.</Text>
            </YStack>
        );
    }

    const onEditPress = canEdit ? () => {
        router.push(`/menus/create?menuId=${id}`);
    } : undefined;

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
                        {menuDetails.menuName}
                    </Text>
                </YStack>
                
                {onEditPress && isEditModeEnabled && (
                    <TouchableOpacity 
                        onPress={onEditPress} 
                        style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.05)" }]}
                    >
                        <IconSymbol name="pencil" size={16} color={theme.color?.get() as string} />
                    </TouchableOpacity>
                )}
            </XStack>

            <ScrollView flex={1} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                <YStack gap="$6">
                    {menuDetails.sections.map((section: any) => {
                        if (!section.data || section.data.length === 0) return null;

                        return (
                            <YStack key={section.id} gap="$3">
                                <Text fontSize={18} fontWeight="bold" color="$color" borderBottomWidth={1} borderBottomColor="$borderColor" paddingBottom="$1">
                                    {section.title}
                                </Text>

                                <YStack gap="$3">
                                    {section.data.map((item: any) => (
                                        <Card
                                            key={item.id}
                                            size="$3"
                                            borderWidth={1}
                                            backgroundColor="$backgroundStrong"
                                            borderColor="$borderColor"
                                            overflow="hidden"
                                            borderRadius={12}
                                        >
                                            <Card.Header flexDirection="row" padding="$3.5" minHeight={90} alignItems="center">
                                                <YStack flex={1} paddingRight="$3" gap="$1" justifyContent="center">
                                                    <XStack justifyContent="space-between" alignItems="center">
                                                        <H4 color="$color" fontSize={16} fontWeight="700" numberOfLines={1} flex={1} paddingRight="$2">
                                                            {item.name}
                                                        </H4>
                                                        {item.price && <Text color="$color8" fontSize={14} fontWeight="bold">{item.price}</Text>}
                                                    </XStack>
                                                    {!!item.description && (
                                                        <Paragraph color="$color11" size="$2" numberOfLines={2}>
                                                            {item.description}
                                                        </Paragraph>
                                                    )}
                                                    {!!item.ingredients && (
                                                        <Text color="$color10" fontSize={12} fontStyle="italic" opacity={0.8} numberOfLines={1}>
                                                            {item.ingredients}
                                                        </Text>
                                                    )}
                                                </YStack>

                                                {item.image && (
                                                    <Image
                                                        source={typeof item.image === "string" ? { uri: item.image } : item.image}
                                                        style={[styles.itemImage, { backgroundColor: theme.color5?.get() as string }]}
                                                        contentFit="cover"
                                                        transition={300}
                                                    />
                                                )}
                                            </Card.Header>
                                        </Card>
                                    ))}
                                </YStack>
                            </YStack>
                        );
                    })}
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
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 10,
    },
});
