import React from "react";
import { Modal, TouchableOpacity, FlatList, View, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Accordion, Label, XStack, YStack, Text, useTheme } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBars } from "@/hooks/useBars";

interface BarAssignmentAccordionProps {
    barId: string | null;
    setBarId: (val: string | null) => void;
    overrideVisibility?: string | null;
    setOverrideVisibility?: (val: string | null) => void;
    overrideGeneric?: string | null;
    setOverrideGeneric?: (val: string | null) => void;
    overrideSpecific?: string | null;
    setOverrideSpecific?: (val: string | null) => void;
    overrideMeasurement?: string | null;
    setOverrideMeasurement?: (val: string | null) => void;
    overridePrep?: string | null;
    setOverridePrep?: (val: string | null) => void;
    marginBottom?: any;
}

interface NativeModalPickerProps {
    value: string;
    onValueChange: (val: string) => void;
    items: { label: string; value: string }[];
    placeholder: string;
    title: string;
}

function NativeModalPicker({ value, onValueChange, items, placeholder, title }: NativeModalPickerProps) {
    const [open, setOpen] = React.useState(false);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    
    const selectedItem = items.find(i => i.value === value) || items[0];

    return (
        <>
            <TouchableOpacity 
                style={{ backgroundColor: theme.background?.get() as string, borderColor: theme.borderColor?.get() as string, borderWidth: 1, padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minWidth: 160 }}
                onPress={() => setOpen(true)}
            >
                <Text color="$color">{selectedItem ? selectedItem.label : placeholder}</Text>
                <IconSymbol name="chevron.down" size={16} color={theme.color11?.get() as string} />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
                        <View style={{ backgroundColor: theme.backgroundStrong?.get() as string, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Math.max(insets.bottom, 20), maxHeight: '80%' }}>
                            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: theme.borderColor?.get() as string, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text fontSize={18} fontWeight="bold" color="$color">{title}</Text>
                                <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 4 }}>
                                    <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                                </TouchableOpacity>
                            </View>
                            <FlatList 
                                data={items}
                                keyExtractor={(item) => item.value}
                                renderItem={({item}) => (
                                    <TouchableOpacity 
                                        style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.borderColor?.get() as string }}
                                        onPress={() => {
                                            onValueChange(item.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <Text color={value === item.value ? theme.color8?.get() as string : "$color11"} fontSize={16}>{item.label}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    )
}

export function BarAssignmentAccordion({
    barId, setBarId,
    overrideVisibility, setOverrideVisibility,
    overrideGeneric, setOverrideGeneric,
    overrideSpecific, setOverrideSpecific,
    overrideMeasurement, setOverrideMeasurement,
    overridePrep, setOverridePrep,
    marginBottom = "$6"
}: BarAssignmentAccordionProps) {
    const theme = useTheme();
    const { data: userBars } = useBars();

    return (
        <Accordion overflow="hidden" width="100%" type="multiple" backgroundColor="transparent" marginBottom={marginBottom}>
            <Accordion.Item value="a1" borderRadius="$4" borderColor="$borderColor" borderWidth={1} backgroundColor="$backgroundStrong">
                <Accordion.Trigger flexDirection="row" justifyContent="space-between" padding="$3" backgroundColor="$backgroundStrong">
                    {({ open }) => (
                        <>
                            <XStack gap="$2" alignItems="center">
                                <IconSymbol name="lock.shield.fill" size={18} color={theme.color11?.get() as string} />
                                <Text color="$color" fontWeight="bold">Bar Assignment & Access</Text>
                            </XStack>
                            <IconSymbol name={open ? "chevron.up" : "chevron.down"} size={16} color={theme.color11?.get() as string} />
                        </>
                    )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="medium">
                    <Accordion.Content animation="medium" exitStyle={{ opacity: 0 }} padding="$3" borderTopWidth={1} borderColor="$borderColor">
                        <YStack gap="$3">
                            <YStack gap="$1">
                                <Label color="$color11">Assign to Bar (Global if empty)</Label>
                                <NativeModalPicker
                                    title="Assign to Bar"
                                    placeholder="Select Bar"
                                    value={barId || 'global'}
                                    onValueChange={(val: string) => setBarId(val === 'global' ? null : val)}
                                    items={[
                                        { label: 'Global / Public', value: 'global' },
                                        ...(userBars || []).map((b: any) => ({ label: b.bars?.name, value: b.bar_id }))
                                    ]}
                                />
                            </YStack>
                            
                            {setOverrideVisibility && (
                                <>
                                    <Text fontSize={12} color="$color11" marginTop="$2" marginBottom="$1">Leave empty to use the Bar&apos;s default rules.</Text>
                                    
                                    {['Visibility', 'Generic Ingredient', 'Specific Brand', 'Measurement', 'Prep'].map((field, idx) => {
                                        const val = [overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep][idx];
                                        const setVal = [setOverrideVisibility, setOverrideGeneric, setOverrideSpecific, setOverrideMeasurement, setOverridePrep][idx];
                                        return (
                                            <XStack key={field} justifyContent="space-between" alignItems="center">
                                                <Label color="$color11" flex={1}>{field} Level</Label>
                                                <NativeModalPicker
                                                    title={`${field} Level`}
                                                    placeholder="Bar Default"
                                                    value={val || 'default'}
                                                    onValueChange={(v: string) => setVal?.(v === 'default' ? null : v)}
                                                    items={[
                                                        { label: 'Bar Default', value: 'default' },
                                                        { label: 'Guest (10)', value: '10' },
                                                        { label: 'Employee (20)', value: '20' },
                                                        { label: 'Bartender (30)', value: '30' },
                                                        { label: 'Drink Creator (35)', value: '35' },
                                                        { label: 'Admin (40)', value: '40' }
                                                    ]}
                                                />
                                            </XStack>
                                        );
                                    })}
                                </>
                            )}
                        </YStack>
                    </Accordion.Content>
                </Accordion.HeightAnimator>
            </Accordion.Item>
        </Accordion>
    );
}
