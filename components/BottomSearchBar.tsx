import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View, ViewStyle } from "react-native";

interface BottomSearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    style?: ViewStyle;
    placeholder?: string;
}

export function BottomSearchBar({ value, onChangeText, style, placeholder = "Find your drink..." }: BottomSearchBarProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View
            style={[
                styles.searchContainer,
                style,
                isFocused && styles.searchContainerFocused
            ]}
        >
            <IconSymbol name="magnifyingglass" size={20} color={isFocused ? "#FFFFFF" : Colors.dark.icon} />
            <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor={Colors.dark.icon}
                value={value}
                onChangeText={onChangeText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
            />
            {value.length > 0 && (
                <TouchableOpacity onPress={() => onChangeText("")}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={Colors.dark.icon} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 10,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12, // More subtle rounded rectangle instead of a pill
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    searchContainerFocused: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchInput: {
        flex: 1,
        color: Colors.dark.text,
        fontSize: 16,
        padding: 0,
        height: 24, // Explicit height for single line
    },
});
