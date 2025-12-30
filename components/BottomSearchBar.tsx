import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { StyleSheet, TextInput, TouchableOpacity, ViewStyle } from "react-native";
import { GlassView } from "./ui/GlassView";

interface BottomSearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    style?: ViewStyle;
    placeholder?: string;
}

export function BottomSearchBar({ value, onChangeText, style, placeholder = "Find your drink..." }: BottomSearchBarProps) {
    return (
        <GlassView style={[styles.searchContainer, style]} intensity={70}>
            <IconSymbol name="magnifyingglass" size={20} color={Colors.dark.icon} />
            <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor={Colors.dark.icon}
                value={value}
                onChangeText={onChangeText}
            />
            {value.length > 0 && (
                <TouchableOpacity onPress={() => onChangeText("")}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={Colors.dark.icon} />
                </TouchableOpacity>
            )}
        </GlassView>
    );
}

const styles = StyleSheet.create({
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 25,
        gap: 10,
        width: '100%'
    },
    searchInput: {
        flex: 1,
        color: Colors.dark.text,
        fontSize: 18,
        padding: 0,
    },
});
