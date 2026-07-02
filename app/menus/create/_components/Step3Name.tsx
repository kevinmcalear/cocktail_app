import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "tamagui";

interface Props {
    name: string;
    onChange: (text: string) => void;
    onNext: () => void;
    onBlur?: () => void;
}

export const Step3Name = ({ name, onChange, onNext, onBlur }: Props) => {
    const inputRef = useRef<TextInput>(null);
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme];
    const isDark = colorScheme === "dark";

    const styles = useMemo(
        () =>
            StyleSheet.create({
                container: { flex: 1 },
                header: { paddingHorizontal: 20, marginBottom: 40 },
                title: { fontSize: 34, fontWeight: "bold", color: colors.text, marginBottom: 8 },
                subtitle: { fontSize: 16, color: colors.icon },
                content: { flex: 1, paddingHorizontal: 20 },
                input: {
                    fontSize: 42,
                    fontWeight: "bold",
                    color: colors.text,
                    borderBottomWidth: 2,
                    borderBottomColor: colors.tint,
                    paddingVertical: 10,
                },
            }),
        [colors],
    );

    useEffect(() => {
        const timeout = setTimeout(() => {
            inputRef.current?.focus();
        }, 400);
        return () => clearTimeout(timeout);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Name your Menu</Text>
                <Text style={styles.subtitle}>Give your new menu a memorable name.</Text>
            </View>

            <View style={styles.content}>
                <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder="e.g. Winter 2026"
                    placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"}
                    value={name}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    selectionColor={colors.tint}
                    autoCapitalize="words"
                    autoCorrect={false}
                    onSubmitEditing={onNext}
                />
            </View>
        </View>
    );
};
