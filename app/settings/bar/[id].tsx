import { useBarDetail } from "@/hooks/useBarDetail";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Input, Label, Text, XStack, YStack, useTheme } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";

const ROLE_OPTIONS = [
    { name: "Guest (10)", value: "10" },
    { name: "Employee (20)", value: "20" },
    { name: "Bartender (30)", value: "30" },
    { name: "Drink Creator (35)", value: "35" },
    { name: "Admin (40)", value: "40" }
];

export default function BarDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: detailData, isLoading } = useBarDetail(id || "");
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const queryClient = useQueryClient();

    const [tab, setTab] = useState<"settings" | "members" | "items">("settings");

    // Settings state
    const [name, setName] = useState("");
    const [visibilityLevel, setVisibilityLevel] = useState("10");
    const [genericLevel, setGenericLevel] = useState("20");
    const [specificLevel, setSpecificLevel] = useState("30");
    const [measurementLevel, setMeasurementLevel] = useState("30");
    const [prepLevel, setPrepLevel] = useState("40");
    const [isSaving, setIsSaving] = useState(false);
    const [hasInitializedForm, setHasInitializedForm] = useState(false);

    // Members state
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [newMemberRole, setNewMemberRole] = useState("10");

    if (!hasInitializedForm && detailData?.bar) {
        setName(detailData.bar.name);
        setVisibilityLevel(detailData.bar.default_visibility_level.toString());
        setGenericLevel(detailData.bar.default_generic_ingredient_level.toString());
        setSpecificLevel(detailData.bar.default_specific_brand_level.toString());
        setMeasurementLevel(detailData.bar.default_measurement_level.toString());
        setPrepLevel(detailData.bar.default_prep_level.toString());
        setHasInitializedForm(true);
    }

    const handleUpdateSettings = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.rpc('update_bar_settings', {
                p_bar_id: id,
                p_name: name.trim(),
                p_visibility: parseInt(visibilityLevel),
                p_generic: parseInt(genericLevel),
                p_specific: parseInt(specificLevel),
                p_measurement: parseInt(measurementLevel),
                p_prep: parseInt(prepLevel)
            });

            if (error) throw new Error(error.message);
            queryClient.invalidateQueries({ queryKey: ['bar', id] });
            queryClient.invalidateQueries({ queryKey: ['bars'] });
            Alert.alert("Success", "Bar settings updated.");
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddMember = async () => {
        if (!newMemberEmail.trim()) return;
        try {
            const { error } = await supabase.rpc('add_user_to_bar_by_email', {
                p_email: newMemberEmail.trim(),
                p_bar_id: id,
                p_role_level: parseInt(newMemberRole)
            });

            if (error) throw new Error(error.message);
            setNewMemberEmail("");
            queryClient.invalidateQueries({ queryKey: ['bar', id] });
            Alert.alert("Success", "Member added/updated.");
        } catch (err: any) {
            Alert.alert("Error", err.message);
        }
    };

    const handleUpdateMemberRole = async (email: string, roleValue: string) => {
        try {
            const { error } = await supabase.rpc('add_user_to_bar_by_email', {
                p_email: email,
                p_bar_id: id,
                p_role_level: parseInt(roleValue)
            });

            if (error) throw new Error(error.message);
            queryClient.invalidateQueries({ queryKey: ['bar', id] });
            Alert.alert("Success", "Member role updated.");
        } catch (err: any) {
            Alert.alert("Error", err.message);
        }
    };

    const renderPills = (label: string, value: string, setValue: (v: string) => void) => (
        <YStack gap="$2" marginBottom="$4">
            <Label color="$color11" marginLeft="$2">{label}</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
                <XStack gap="$2">
                    {ROLE_OPTIONS.map((opt) => (
                        <Button
                            key={opt.value}
                            size="$3"
                            borderRadius="$10"
                            backgroundColor={value === opt.value ? theme.color8?.get() as string : "$background"}
                            borderColor={value === opt.value ? theme.color8?.get() as string : "$borderColor"}
                            borderWidth={1}
                            onPress={() => setValue(opt.value)}
                        >
                            <Text color={value === opt.value ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} fontWeight={value === opt.value ? "bold" : "normal"}>
                                {opt.name}
                            </Text>
                        </Button>
                    ))}
                </XStack>
            </ScrollView>
        </YStack>
    );

    return (
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <XStack
                paddingHorizontal="$4"
                paddingBottom="$4"
                paddingTop="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">{detailData?.bar?.name || "Loading..."}</Text>
                <View style={{ width: 40 }} />
            </XStack>

            <XStack paddingHorizontal="$4" marginBottom="$4" gap="$2">
                <Button flex={1} size="$3" onPress={() => setTab('settings')} backgroundColor={tab === 'settings' ? '$color8' : '$backgroundStrong'}>
                    <Text color={tab === 'settings' ? '$backgroundStrong' : '$color'} fontWeight="bold">Settings</Text>
                </Button>
                <Button flex={1} size="$3" onPress={() => setTab('members')} backgroundColor={tab === 'members' ? '$color8' : '$backgroundStrong'}>
                    <Text color={tab === 'members' ? '$backgroundStrong' : '$color'} fontWeight="bold">Members</Text>
                </Button>
                <Button flex={1} size="$3" onPress={() => setTab('items')} backgroundColor={tab === 'items' ? '$color8' : '$backgroundStrong'}>
                    <Text color={tab === 'items' ? '$backgroundStrong' : '$color'} fontWeight="bold">Items</Text>
                </Button>
            </XStack>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                    {isLoading ? (
                        <ActivityIndicator />
                    ) : tab === 'settings' ? (
                        <YStack>
                            <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4" marginBottom="$4">
                                <YStack gap="$2">
                                    <Label color="$color11">Bar Name *</Label>
                                    <Input
                                        value={name}
                                        onChangeText={setName}
                                        placeholderTextColor="$color11"
                                        size="$4"
                                        backgroundColor="$background"
                                        borderColor="$borderColor"
                                        focusStyle={{ borderColor: '$color8' }}
                                    />
                                </YStack>
                            </Card>

                            <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                                <YStack gap="$0" paddingTop="$2">
                                    {renderPills("General Visibility", visibilityLevel, setVisibilityLevel)}
                                    {renderPills("Generic Ingredients", genericLevel, setGenericLevel)}
                                    {renderPills("Specific Brands", specificLevel, setSpecificLevel)}
                                    {renderPills("Measurements", measurementLevel, setMeasurementLevel)}
                                    {renderPills("Prep Instructions", prepLevel, setPrepLevel)}
                                </YStack>
                            </Card>

                            <Button 
                                marginTop="$6" 
                                backgroundColor="$color8" 
                                color="$backgroundStrong" 
                                fontWeight="bold"
                                onPress={handleUpdateSettings}
                                disabled={isSaving}
                            >
                                {isSaving ? <ActivityIndicator color={theme.backgroundStrong?.get() as string} /> : "Save Settings"}
                            </Button>
                        </YStack>
                    ) : tab === 'members' ? (
                        <YStack gap="$4">
                            <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                                <Text fontWeight="bold" fontSize={16} marginBottom="$4">Add Member</Text>
                                <YStack gap="$2">
                                    <Input
                                        value={newMemberEmail}
                                        onChangeText={setNewMemberEmail}
                                        placeholder="User Email"
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        backgroundColor="$background"
                                    />
                                    {renderPills("Role", newMemberRole, setNewMemberRole)}
                                    <Button onPress={handleAddMember} backgroundColor="$color8" color="$backgroundStrong">
                                        Add / Update Member
                                    </Button>
                                </YStack>
                            </Card>

                            <Text fontWeight="bold" fontSize={16} marginTop="$4">Current Members</Text>
                            {detailData?.members?.map((m: any) => (
                                <Card key={m.user_id} bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                                    <YStack gap="$2">
                                        <Text fontWeight="bold">{m.email}</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 0 }}>
                                            <XStack gap="$2">
                                                {ROLE_OPTIONS.map((opt) => (
                                                    <Button
                                                        key={opt.value}
                                                        size="$3"
                                                        borderRadius="$10"
                                                        backgroundColor={m.role_level.toString() === opt.value ? theme.color8?.get() as string : "$background"}
                                                        borderColor={m.role_level.toString() === opt.value ? theme.color8?.get() as string : "$borderColor"}
                                                        borderWidth={1}
                                                        onPress={() => handleUpdateMemberRole(m.email, opt.value)}
                                                    >
                                                        <Text color={m.role_level.toString() === opt.value ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} fontWeight={m.role_level.toString() === opt.value ? "bold" : "normal"}>
                                                            {opt.name}
                                                        </Text>
                                                    </Button>
                                                ))}
                                            </XStack>
                                        </ScrollView>
                                    </YStack>
                                </Card>
                            ))}
                        </YStack>
                    ) : (
                        <YStack gap="$4">
                            <XStack justifyContent="space-between" alignItems="center">
                                <Text fontWeight="bold" fontSize={16}>Assigned Items</Text>
                                <Button size="$3" onPress={() => router.push(`/settings/bar/${id}/assign-items`)}>
                                    Assign Item
                                </Button>
                            </XStack>
                            
                            {detailData?.items?.length === 0 ? (
                                <Text color="$color11" textAlign="center" marginTop="$4">No items assigned to this bar yet.</Text>
                            ) : (
                                detailData?.items?.map((item: any) => (
                                    <Card key={item.id} bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                                        <YStack>
                                            <Text fontWeight="bold">{item.name}</Text>
                                            <Text color="$color11" fontSize={12} textTransform="capitalize">{item.item_type}</Text>
                                        </YStack>
                                    </Card>
                                ))
                            )}
                        </YStack>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </YStack>
    );
}
import { View } from "react-native";
