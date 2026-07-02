import { CustomIcon } from "@/components/ui/CustomIcons";
import { Button, Text, XStack, useTheme } from "tamagui";

interface SpecPillButtonProps {
    name: string;
    selected: boolean;
    onPress: () => void;
    onLongPress?: () => void;
}

export function SpecPillButton({ name, selected, onPress, onLongPress }: SpecPillButtonProps) {
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
                <CustomIcon name={name} size={16} color={iconColor} />
                <Text color={selected ? "$backgroundStrong" : "$color"} fontWeight={selected ? "bold" : "normal"}>
                    {name}
                </Text>
            </XStack>
        </Button>
    );
}
