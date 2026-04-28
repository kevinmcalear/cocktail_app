import { supabase } from "@/lib/supabase";
import { useAuth } from "@/ctx/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Input, Label, Select, Sheet, Adapt, Text, XStack, YStack, useTheme, Card } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";

const ROLE_OPTIONS = [
    { name: "Guest (10)", value: "10" },
    { name: "Trainee (20)", value: "20" },
    { name: "Bartender (30)", value: "30" },
    { name: "Admin (40)", value: "40" }
];

export default function CreateBarScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [name, setName] = useState("");
    const [visibilityLevel, setVisibilityLevel] = useState("10");
    const [genericLevel, setGenericLevel] = useState("20");
    const [specificLevel, setSpecificLevel] = useState("30");
    const [measurementLevel, setMeasurementLevel] = useState("30");
    const [prepLevel, setPrepLevel] = useState("40");
    const [isSaving, setIsSaving] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert("Required", "Please enter a Bar Name.");
            return;
        }

        if (!user) {
            Alert.alert("Error", "You must be logged in to create a bar.");
            return;
        }

        setIsSaving(true);
        try {
            // Call the atomic RPC function to create the bar and assign the user as an Admin
            const { data: barData, error: barError } = await supabase.rpc('create_new_bar', {
                p_name: name.trim(),
                p_visibility: parseInt(visibilityLevel),
                p_generic: parseInt(genericLevel),
                p_specific: parseInt(specificLevel),
                p_measurement: parseInt(measurementLevel),
                p_prep: parseInt(prepLevel)
            });

            if (barError || !barData) {
                console.error("Bar RPC error:", barError);
                throw new Error(barError?.message || "Failed to create the bar.");
            }

            // Success! Refetch bars and go back
            queryClient.invalidateQueries({ queryKey: ['bars'] });
            
            Alert.alert("Success", `${name} has been created! You have been assigned as an Admin.`, [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error: any) {
            Alert.alert("Error", error.message || "An unexpected error occurred.");
        } finally {
            setIsSaving(false);
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
                <Text fontSize="$5" fontWeight="bold">Create New Bar</Text>
                <Button 
                    onPress={handleCreate} 
                    disabled={isSaving}
                    size="$3"
                    chromeless
                    paddingHorizontal="$0"
                >
                    {isSaving ? <ActivityIndicator size="small" color={theme.color8?.get() as string} /> : <Text color={theme.color8?.get() as string} fontWeight="bold">Create</Text>}
                </Button>
            </XStack>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                    
                    <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4" marginBottom="$4">
                        <YStack gap="$2">
                            <Label color="$color11">Bar Name *</Label>
                            <Input
                                value={name}
                                onChangeText={setName}
                                placeholderTextColor="$color11"
                                placeholder="e.g. Caretakers Cottage"
                                size="$4"
                                backgroundColor="$background"
                                borderColor="$borderColor"
                                focusStyle={{ borderColor: '$color8' }}
                            />
                        </YStack>
                    </Card>

                    <Text fontSize={14} color="$color11" marginBottom="$2" marginLeft="$2">
                        Configure the default progressive disclosure rules for all cocktails assigned to this bar. You can always override these on a per-cocktail basis.
                    </Text>

                    <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                        <YStack gap="$0" paddingTop="$2">
                            {renderPills("General Visibility", visibilityLevel, setVisibilityLevel)}
                            {renderPills("Generic Ingredients", genericLevel, setGenericLevel)}
                            {renderPills("Specific Brands", specificLevel, setSpecificLevel)}
                            {renderPills("Measurements", measurementLevel, setMeasurementLevel)}
                            {renderPills("Prep Instructions", prepLevel, setPrepLevel)}
                        </YStack>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </YStack>
    );
}
