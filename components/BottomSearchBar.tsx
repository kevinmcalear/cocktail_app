import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState } from "react";
import { ViewStyle } from "react-native";
import { Button, Input, XStack, useTheme } from "tamagui";

interface BottomSearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    style?: ViewStyle;
    placeholder?: string;
    onFilterPress?: () => void;
}

export function BottomSearchBar({ value, onChangeText, style, placeholder = "Find your drink...", onFilterPress }: BottomSearchBarProps) {
    const theme = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    return (
        <XStack
            alignItems="center"
            backgroundColor="$backgroundStrong"
            borderWidth={0}
            borderColor="transparent"
            borderRadius="$10"
            paddingHorizontal="$4"
            height={56}
            gap="$3"
            elevation="$2"
            style={style as object}
        >
            <IconSymbol name="magnifyingglass" size={22} color={isFocused ? theme.color8?.get() as string : theme.color11?.get() as string} />
            <Input
                flex={1}
                unstyled
                size="$4"
                paddingVertical={0}
                placeholder={placeholder}
                placeholderTextColor="$color11"
                color="$color"
                fontSize={16}
                value={value}
                onChangeText={onChangeText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                fontFamily="$body"
            />
            {value.length > 0 && (
                <Button unstyled onPress={() => onChangeText("")} padding="$1" pressStyle={{ opacity: 0.5 }}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={theme.color11?.get() as string} />
                </Button>
            )}
            {onFilterPress && (
                <Button unstyled onPress={onFilterPress} padding="$2" pressStyle={{ opacity: 0.5 }}>
                    <IconSymbol name="line.3.horizontal.decrease" size={24} color={theme.color11?.get() as string} />
                </Button>
            )}
        </XStack>
    );
}
