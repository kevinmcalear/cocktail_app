import { IconSymbol } from "@/components/ui/icon-symbol";
import { AnimatePresence, MotiView } from "moti";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View, ViewStyle } from "react-native";
import { Button, Input, Text, useTheme, XStack, YStack } from "tamagui";

export interface SearchChip {
    id: string;
    label: string;
    type: string;
}

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    style?: ViewStyle;
    placeholder?: string;
    onFilterPress?: () => void;
    chips?: SearchChip[];
    onRemoveChip?: (id: string) => void;
    suggestions?: SearchChip[];
    onSuggestionPress?: (suggestion: SearchChip) => void;
}

export function SearchBar({ 
    value, 
    onChangeText, 
    style, 
    placeholder = "Find your drink...", 
    onFilterPress,
    chips = [],
    onRemoveChip,
    suggestions = [],
    onSuggestionPress
}: SearchBarProps) {
    const theme = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    return (
        <View style={[{ zIndex: 50 }, style] as object}>
            <YStack
                backgroundColor="$backgroundStrong"
                borderWidth={0}
                borderColor="transparent"
                borderRadius="$10"
                elevation="$2"
            >
                {/* Text Input Row */}
                <XStack
                    alignItems="center"
                    paddingHorizontal="$4"
                    height={56}
                    gap="$3"
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
                    <XStack 
                        flexWrap="wrap" 
                        paddingHorizontal="$4" 
                        overflow="hidden"
                    >
                        <AnimatePresence>
                            {chips.map(chip => (
                                <MotiView
                                    key={`chip-${chip.id}`}
                                    from={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ type: "timing", duration: 250 }}
                                >
                                    <XStack 
                                        backgroundColor="rgba(255,255,255,0.08)"
                                        borderRadius="$8"
                                        alignItems="center"
                                        paddingVertical="$1.5"
                                        paddingLeft="$3"
                                        paddingRight="$2"
                                        marginBottom="$2.5"
                                        marginRight="$2"
                                        gap="$1.5"
                                        borderWidth={0}
                                    >
                                        <Text color="$color" fontSize={13} fontWeight="500">{chip.label}</Text>
                                        <TouchableOpacity 
                                            onPress={() => onRemoveChip?.(chip.id)} 
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={{ padding: 4 }}
                                        >
                                            <IconSymbol name="xmark" size={11} color={theme.color?.get() as string} weight="bold" />
                                        </TouchableOpacity>
                                    </XStack>
                                </MotiView>
                            ))}
                        </AnimatePresence>
                    </XStack>
            </YStack>

            {/* Suggestions Dropdown */}
            {isFocused && suggestions.length > 0 && (
                <View style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 8,
                    backgroundColor: theme.backgroundStrong?.get() as string,
                    borderRadius: 16,
                    paddingVertical: 8,
                    shadowColor: '#000',
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 10,
                }}>
                    <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                        {suggestions.map((item, index) => (
                            <TouchableOpacity 
                                key={`sug-${item.type}-${item.id}-${index}`}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
                                    borderBottomColor: 'rgba(255,255,255,0.05)',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                                onPress={() => onSuggestionPress?.(item)}
                            >
                                <Text color="$color" fontSize={15}>{item.label}</Text>
                                <Text color="$color11" fontSize={12} fontFamily="IBMPlexSansItalic" opacity={0.8}>
                                    {item.type.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}
