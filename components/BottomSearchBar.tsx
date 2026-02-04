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
        padding: 16,
        borderRadius: 25,
        gap: 10,
        width: '100%',
        backgroundColor: '#1C1C1E', // Solid System Gray 6
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchContainerFocused: {
        backgroundColor: '#2C2C2E', // Slightly lighter gray when focused
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    searchInput: {
        flex: 1,
        color: Colors.dark.text,
        fontSize: 18,
        padding: 0,
        height: 24, // Explicit height for single line
    },
});
