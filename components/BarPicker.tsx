import { useBars } from '@/hooks/useBars';
import { useAppStore } from '@/store/useAppStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { XStack, Text, useTheme, Select, YStack, Adapt, Sheet } from 'tamagui';

export function BarPicker() {
    const { data: bars } = useBars();
    const { selectedBarId, setSelectedBarId } = useAppStore();
    const theme = useTheme();

    if (!bars || bars.length === 0) {
        return null; // Don't show picker if user has no bars
    }

    const currentBarName = selectedBarId 
        ? bars.find((b: any) => b.bar_id === selectedBarId)?.bars?.name || 'Global' 
        : 'Global Context';

    return (
        <XStack paddingHorizontal="$4" paddingBottom="$3" paddingTop="$1">
            <Select
                value={selectedBarId || 'global'}
                onValueChange={(val) => setSelectedBarId(val === 'global' ? null : val)}
                disablePreventBodyScroll
            >
                <Select.Trigger width="100%" backgroundColor="$color3" borderRadius="$4" borderWidth={0} iconAfter={<IconSymbol name="chevron.down" size={16} color={theme.color11?.get() as string} />}>
                    <Select.Value placeholder="Select Context">
                        <XStack alignItems="center" gap="$2">
                            <IconSymbol name="building.2.fill" size={16} color={theme.color11?.get() as string} />
                            <Text color="$color" fontWeight="600">{currentBarName}</Text>
                        </XStack>
                    </Select.Value>
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
                            <Select.Label>Switch Context</Select.Label>
                            <Select.Item index={0} value="global">
                                <Select.ItemText>Global Context</Select.ItemText>
                                <Select.ItemIndicator marginLeft="auto">
                                    <IconSymbol name="checkmark" size={16} color={theme.color?.get() as string} />
                                </Select.ItemIndicator>
                            </Select.Item>
                            
                            {bars.map((bar: any, i: number) => (
                                <Select.Item key={bar.bar_id} index={i + 1} value={bar.bar_id}>
                                    <Select.ItemText>{bar.bars?.name}</Select.ItemText>
                                    <Select.ItemIndicator marginLeft="auto">
                                        <IconSymbol name="checkmark" size={16} color={theme.color?.get() as string} />
                                    </Select.ItemIndicator>
                                </Select.Item>
                            ))}
                        </Select.Group>
                    </Select.Viewport>
                </Select.Content>
            </Select>
        </XStack>
    );
}
