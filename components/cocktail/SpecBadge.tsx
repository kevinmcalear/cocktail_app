import { GlasswareIcon } from "@/components/ui/GlasswareIcon";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TouchableOpacity } from "react-native";
import { Text, useTheme, YStack } from "tamagui";

interface SpecBadgeProps {
    label: string;
    value?: string | null;
    emptyLabel?: string;
    isEditing?: boolean;
    onPress?: () => void;
    iconKey?: string | null;
    iconUrl?: string | null;
}

export function SpecBadge({ label, value, emptyLabel, isEditing, onPress, iconKey, iconUrl }: SpecBadgeProps) {
    const theme = useTheme();
    const display = value || emptyLabel || label;
    const isEmpty = !value;
    const interactive = isEditing && onPress;
    const labelUsesAccent = isEmpty || interactive;

    const content = (
        <YStack alignItems="center" gap="$1" justifyContent="flex-start" minWidth={52}>
            <YStack
                height={26}
                justifyContent="flex-end"
                alignItems="center"
                opacity={isEmpty ? 0.4 : 1}
            >
                {value ? (
                    iconKey || iconUrl ? (
                        <GlasswareIcon
                            name={value}
                            iconKey={iconKey}
                            iconUrl={iconUrl}
                            size={24}
                            color={theme.color?.get() as string}
                        />
                    ) : (
                        <CustomIcon name={value} size={24} color={theme.color?.get() as string} />
                    )
                ) : (
                    <IconSymbol name="plus" size={20} color={theme.color8?.get() as string} style={{ opacity: 0.7 }} />
                )}
            </YStack>
            <Text
                color={labelUsesAccent ? "$color8" : "$color"}
                fontSize={9}
                opacity={labelUsesAccent ? 0.9 : 0.6}
                fontWeight="600"
                textAlign="center"
                textTransform="uppercase"
                letterSpacing={0.5}
                numberOfLines={2}
            >
                {display}
            </Text>
        </YStack>
    );

    if (!interactive) return content;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            {content}
        </TouchableOpacity>
    );
}
