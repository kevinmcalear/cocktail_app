import React from "react";
import { Accordion, Label, Select, Adapt, Sheet, XStack, YStack, Text, useTheme } from "tamagui";
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
                                <Select value={barId || 'global'} onValueChange={(val) => setBarId(val === 'global' ? null : val)} disablePreventBodyScroll>
                                    <Select.Trigger backgroundColor="$background" borderColor="$borderColor">
                                        <Select.Value placeholder="Select Bar" color="$color" />
                                    </Select.Trigger>
                                    <Adapt when="sm" reaches="sm">
                                        <Sheet modal dismissOnSnapToBottom animation="quick">
                                            <Sheet.Frame>
                                                <Sheet.ScrollView>
                                                    <Adapt.Contents />
                                                </Sheet.ScrollView>
                                            </Sheet.Frame>
                                            <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
                                        </Sheet>
                                    </Adapt>
                                    <Select.Content zIndex={200000}>
                                        <Select.Viewport minWidth={200}>
                                            <Select.Group>
                                                <Select.Item index={0} value="global"><Select.ItemText>Global / Public</Select.ItemText></Select.Item>
                                                {userBars?.map((b: any, i: number) => (
                                                    <Select.Item key={b.bar_id} index={i+1} value={b.bar_id}><Select.ItemText>{b.bars?.name}</Select.ItemText></Select.Item>
                                                ))}
                                            </Select.Group>
                                        </Select.Viewport>
                                    </Select.Content>
                                </Select>
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
                                                <Select value={val || 'default'} onValueChange={(v) => setVal?.(v === 'default' ? null : v)} disablePreventBodyScroll>
                                                    <Select.Trigger width={160} backgroundColor="$background" borderColor="$borderColor" size="$3">
                                                        <Select.Value placeholder="Bar Default" color="$color" />
                                                    </Select.Trigger>
                                                    <Adapt when="sm" reaches="sm">
                                                        <Sheet modal dismissOnSnapToBottom animation="quick">
                                                            <Sheet.Frame>
                                                                <Sheet.ScrollView>
                                                                    <Adapt.Contents />
                                                                </Sheet.ScrollView>
                                                            </Sheet.Frame>
                                                            <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
                                                        </Sheet>
                                                    </Adapt>
                                                    <Select.Content zIndex={200000}>
                                                        <Select.Viewport minWidth={200}>
                                                            <Select.Group>
                                                                <Select.Item index={0} value="default"><Select.ItemText>Bar Default</Select.ItemText></Select.Item>
                                                                <Select.Item index={1} value="10"><Select.ItemText>Guest (10)</Select.ItemText></Select.Item>
                                                                <Select.Item index={2} value="20"><Select.ItemText>Employee (20)</Select.ItemText></Select.Item>
                                                                <Select.Item index={3} value="30"><Select.ItemText>Bartender (30)</Select.ItemText></Select.Item>
                                                                <Select.Item index={4} value="35"><Select.ItemText>Drink Creator (35)</Select.ItemText></Select.Item>
                                                                <Select.Item index={5} value="40"><Select.ItemText>Admin (40)</Select.ItemText></Select.Item>
                                                            </Select.Group>
                                                        </Select.Viewport>
                                                    </Select.Content>
                                                </Select>
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
