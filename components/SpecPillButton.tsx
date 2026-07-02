import { GlasswareIcon } from "@/components/ui/GlasswareIcon";
import { Button, Text, XStack, useTheme } from "tamagui";

interface SpecPillButtonProps {
    name: string;
    selected: boolean;
    onPress: () => void;
    onLongPress?: () => void;
    iconKey?: string | null;
    iconUrl?: string | null;
}

export function SpecPillButton({ name, selected, onPress, onLongPress, iconKey, iconUrl }: SpecPillButtonProps) {
    const theme = useTheme();
    const iconColor = selected ? theme.backgroundStrong?.get() as string : theme.color?.get() as string;

    return (
        <Button
            size="$3"
            borderRadius="$10"
            backgroundColor={selected ? "$color8" : "$backgroundStrong"}
            borderColor={selected ? "$color8" : "$borderColor"}
            borderWidth={1}
            onPress={onPress}
            onLongPress={onLongPress}
        >
            <XStack gap="$2" alignItems="center">
                <GlasswareIcon name={name} iconKey={iconKey} iconUrl={iconUrl} size={16} color={iconColor} />
                <Text color={selected ? "$backgroundStrong" : "$color"} fontWeight={selected ? "bold" : "normal"}>
                    {name}
                </Text>
            </XStack>
        </Button>
    );
}
