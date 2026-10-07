import { GlasswareIcon } from "@/components/ui/GlasswareIcon";
import { hasCustomIcon } from "@/components/ui/CustomIcons";
import { Button, Text, XStack, useTheme } from "tamagui";

interface SpecPillButtonProps {
    name: string;
    selected: boolean;
    onPress: () => void;
    iconKey?: string | null;
    iconUrl?: string | null;
}

export function SpecPillButton({ name, selected, onPress, iconKey, iconUrl }: SpecPillButtonProps) {
    const theme = useTheme();
    const iconColor = selected ? theme.backgroundStrong?.get() as string : theme.color?.get() as string;
    const showIcon = !!(iconUrl || iconKey || hasCustomIcon(name));

    return (
        <Button
            size="$3"
            borderRadius="$10"
            backgroundColor={selected ? "$color8" : "$backgroundStrong"}
            borderColor={selected ? "$color8" : "$borderColor"}
            borderWidth={1}
            // Keep the selected colours under the pointer: the default hover is a pale
            // background behind the selected pill's light text (multi-select stays open).
            hoverStyle={selected ? { backgroundColor: "$color8", borderColor: "$color8" } : undefined}
            pressStyle={selected ? { backgroundColor: "$color8", borderColor: "$color8" } : undefined}
            onPress={onPress}
        >
            <XStack gap="$2" alignItems="center">
                {showIcon && (
                    <GlasswareIcon name={name} iconKey={iconKey} iconUrl={iconUrl} size={16} color={iconColor} />
                )}
                <Text color={selected ? "$backgroundStrong" : "$color"} fontWeight={selected ? "bold" : "normal"}>
                    {name}
                </Text>
            </XStack>
        </Button>
    );
}
