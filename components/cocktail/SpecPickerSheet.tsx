import React from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from "react-native";
import * as FilePicker from "expo-image-picker";

import { SpecPillButton } from "@/components/SpecPillButton";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { GlasswareIcon } from "@/components/ui/GlasswareIcon";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { SpecCategory } from "@/hooks/useCocktailEditor";
import { uriToBase64 } from "@/lib/imageBase64";
import type { GlasswareIdentifyResult } from "@/lib/identifyGlassware";
import { Button, Input, Text, useTheme, XStack, YStack } from "tamagui";

export interface SpecOption {
    id: string;
    name: string;
    icon_key?: string | null;
    icon_url?: string | null;
}

interface SpecPickerSheetProps {
    visible: boolean;
    title: string;
    category: SpecCategory;
    options: SpecOption[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onClose: () => void;
    allowDeselect?: boolean;
    onDelete?: (item: SpecOption) => void;
    onAdd?: (name: string) => Promise<string | void>;
    onAddGlassware?: (payload: {
        name: string;
        iconKey: string | null;
        iconUrl: string | null;
    }) => Promise<string | void>;
    onIdentifyGlassware?: (imageBase64: string, mimeType: string) => Promise<GlasswareIdentifyResult>;
}

function showError(title: string, message: string) {
    if (Platform.OS === "web") {
        window.alert(`${title}\n\n${message}`);
        return;
    }
    Alert.alert(title, message);
}

export function SpecPickerSheet({
    visible,
    title,
    category,
    options,
    selectedId,
    onSelect,
    onClose,
    allowDeselect,
    onDelete,
    onAdd,
    onAddGlassware,
    onIdentifyGlassware,
}: SpecPickerSheetProps) {
    const theme = useTheme();
    const [adding, setAdding] = React.useState(false);
    const [newName, setNewName] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [scanning, setScanning] = React.useState(false);
    const [scanStatus, setScanStatus] = React.useState<string | null>(null);
    const [scanResult, setScanResult] = React.useState<GlasswareIdentifyResult | null>(null);
    const [scanName, setScanName] = React.useState("");

    const isGlassware = category === "glassware";

    React.useEffect(() => {
        if (!visible) {
            setAdding(false);
            setNewName("");
            setScanning(false);
            setScanStatus(null);
            setScanResult(null);
            setScanName("");
        }
    }, [visible]);

    const handleAdd = async () => {
        if (!onAdd || !newName.trim()) return;
        setSaving(true);
        try {
            const newId = await onAdd(newName.trim());
            setNewName("");
            setAdding(false);
            if (typeof newId === "string" && newId) onSelect(newId);
            onClose();
        } catch (err: any) {
            showError("Error", err?.message || `Could not add ${title.toLowerCase()}.`);
        } finally {
            setSaving(false);
        }
    };

    const handleScanPhoto = async () => {
        if (!onIdentifyGlassware) return;

        const { status } = await FilePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            showError("Permission needed", "We need access to your photos.");
            return;
        }

        const result = await FilePicker.launchImageLibraryAsync({
            mediaTypes: FilePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.55,
        });
        if (result.canceled) return;

        setScanning(true);
        setScanResult(null);
        setScanStatus("Reading photo…");
        try {
            const asset = result.assets[0];
            const base64 = await uriToBase64(asset.uri);
            const mimeType = asset.mimeType?.replace("image/jpg", "image/jpeg") || "image/jpeg";

            setScanStatus("Identifying glass shape…");
            const identified = await onIdentifyGlassware(base64, mimeType);

            if (!identified.matchedIcon && !identified.iconUrl) {
                throw new Error("Could not match or generate an icon for this glass.");
            }

            setScanResult(identified);
            setScanName(identified.suggestedName);
            setScanStatus(null);
        } catch (err: any) {
            console.error("Glassware identify failed:", err);
            showError("Could not identify glass", err.message || "Try again with a clearer photo.");
            setScanStatus(null);
        } finally {
            setScanning(false);
        }
    };

    const handleConfirmScan = async () => {
        if (!onAddGlassware || !scanResult || !scanName.trim()) return;
        setSaving(true);
        try {
            const newId = await onAddGlassware({
                name: scanName.trim(),
                iconKey: scanResult.matchedIcon,
                iconUrl: scanResult.iconUrl,
            });
            if (newId) onSelect(newId);
            onClose();
        } catch (err: any) {
            showError("Error", err.message || "Could not save glassware.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdaptiveSheetModal visible={visible} onClose={onClose} title={title}>
            <View style={styles.contentWrap}>
                <YStack paddingHorizontal="$5" paddingBottom="$4" gap="$3">
                    {isGlassware && onIdentifyGlassware && !scanResult && (
                        <Button
                            size="$4"
                            borderRadius="$4"
                            backgroundColor="$backgroundStrong"
                            borderWidth={1}
                            borderColor="$borderColor"
                            onPress={handleScanPhoto}
                            disabled={scanning}
                        >
                            <XStack gap="$2" alignItems="center" justifyContent="center">
                                <IconSymbol name="camera.fill" size={18} color={theme.color?.get() as string} />
                                <Text color="$color" fontWeight="600">
                                    Identify from photo
                                </Text>
                            </XStack>
                        </Button>
                    )}

                    {scanResult && (
                        <YStack
                            gap="$3"
                            padding="$4"
                            borderRadius="$4"
                            backgroundColor="$backgroundStrong"
                            borderWidth={1}
                            borderColor="$borderColor"
                        >
                            <XStack gap="$3" alignItems="center">
                                <GlasswareIcon
                                    name={scanName}
                                    iconKey={scanResult.matchedIcon}
                                    iconUrl={scanResult.iconUrl}
                                    size={40}
                                    color={theme.color?.get() as string}
                                />
                                <YStack flex={1} gap="$1">
                                    <Text color="$color11" fontSize={11} textTransform="uppercase" letterSpacing={0.5}>
                                        {scanResult.matchedIcon ? "Matched icon" : "Custom icon created"}
                                    </Text>
                                    <Input
                                        size="$3"
                                        value={scanName}
                                        onChangeText={setScanName}
                                        backgroundColor="$background"
                                        borderColor="$borderColor"
                                        autoFocus
                                    />
                                </YStack>
                            </XStack>
                            {scanResult.matchedIcon && (
                                <Text color="$color11" fontSize={12}>
                                    Shape matched to {scanResult.matchedIcon}. Edit the name if needed.
                                </Text>
                            )}
                            <Text color="$color11" fontSize={12}>
                                Tap &quot;Use this glass&quot; to add it, then save your cocktail.
                            </Text>
                            <XStack gap="$3" justifyContent="flex-end">
                                <Button chromeless onPress={() => setScanResult(null)}>
                                    <Text color="$color11">Back</Text>
                                </Button>
                                <Button
                                    backgroundColor="$color8"
                                    onPress={handleConfirmScan}
                                    disabled={saving || !scanName.trim()}
                                >
                                    <Text color="$backgroundStrong" fontWeight="bold">
                                        {saving ? "Saving…" : "Use this glass"}
                                    </Text>
                                </Button>
                            </XStack>
                        </YStack>
                    )}

                    {!scanResult && (
                        <XStack flexWrap="wrap" gap="$2">
                            {options.map((opt) => (
                                <SpecPillButton
                                    key={opt.id}
                                    name={opt.name}
                                    iconKey={opt.icon_key}
                                    iconUrl={opt.icon_url}
                                    selected={selectedId === opt.id}
                                    onPress={() => {
                                        if (allowDeselect && selectedId === opt.id) {
                                            onSelect(null);
                                        } else {
                                            onSelect(opt.id);
                                        }
                                        onClose();
                                    }}
                                    onLongPress={onDelete ? () => onDelete(opt) : undefined}
                                />
                            ))}
                            {onAdd && !adding && (
                                <Button
                                    size="$3"
                                    borderRadius="$10"
                                    borderStyle="dashed"
                                    backgroundColor="transparent"
                                    borderWidth={1}
                                    borderColor="rgba(255,255,255,0.2)"
                                    onPress={() => setAdding(true)}
                                >
                                    <Text color={theme.color8?.get() as string}>+ Add</Text>
                                </Button>
                            )}
                        </XStack>
                    )}

                    {adding && onAdd && !scanResult && (
                        <YStack gap="$3" marginTop="$1">
                            <Input
                                size="$4"
                                placeholder={`New ${title.toLowerCase()}`}
                                value={newName}
                                onChangeText={setNewName}
                                backgroundColor="$backgroundStrong"
                                borderColor="$borderColor"
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleAdd}
                            />
                            <XStack gap="$3" justifyContent="flex-end">
                                <Button chromeless onPress={() => setAdding(false)}>
                                    <Text color="$color11">Cancel</Text>
                                </Button>
                                <Button
                                    backgroundColor="$color8"
                                    onPress={handleAdd}
                                    disabled={saving || !newName.trim()}
                                >
                                    <Text color="$backgroundStrong" fontWeight="bold">
                                        Add
                                    </Text>
                                </Button>
                            </XStack>
                        </YStack>
                    )}
                </YStack>

                {scanning && (
                    <View style={styles.scanOverlay} pointerEvents="auto">
                        <ActivityIndicator size="large" color={theme.color?.get() as string} />
                        <Text color="$color" fontWeight="600" marginTop="$3" textAlign="center">
                            {scanStatus || "Analyzing photo…"}
                        </Text>
                        <Text color="$color11" fontSize={12} marginTop="$2" textAlign="center" paddingHorizontal="$4">
                            This can take up to 30 seconds while we match or create an icon.
                        </Text>
                    </View>
                )}
            </View>
        </AdaptiveSheetModal>
    );
}

const styles = StyleSheet.create({
    contentWrap: {
        position: "relative",
        minHeight: 120,
    },
    scanOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.72)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        zIndex: 20,
    },
});
