import { Colors } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "tamagui";

interface Props {
    name: string;
    onChange: (text: string) => void;
    onNext: () => void;
}

export const Step2Name = ({ name, onChange, onNext }: Props) => {
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Auto-focus slightly after component mounts for the animation to complete
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
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={name}
                    onChangeText={onChange}
                    selectionColor={Colors.dark.tint}
                    autoCapitalize="words"
                    autoCorrect={false}
                    onSubmitEditing={onNext}
                />
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 40,
    },
    title: {
        fontSize: 34,
        fontWeight: "bold",
        color: Colors.dark.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.icon,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    input: {
        fontSize: 42,
        fontWeight: "bold",
        color: Colors.dark.text,
        borderBottomWidth: 2,
        borderBottomColor: Colors.dark.tint,
        paddingVertical: 10,
    }
});
