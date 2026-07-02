import React from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, useTheme } from "tamagui";

import { IconSymbol } from "@/components/ui/icon-symbol";

interface AdaptiveSheetModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: ViewStyle["maxHeight"];
}

export function AdaptiveSheetModal({
    visible,
    onClose,
    title,
    children,
    maxHeight = "70%",
}: AdaptiveSheetModalProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const isWeb = Platform.OS === "web";

    return (
        <Modal
            visible={visible}
            transparent
            animationType={isWeb ? "fade" : "slide"}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={[styles.overlay, isWeb && styles.overlayWeb]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                    <View
                        style={[
                            styles.panel,
                            isWeb ? styles.panelWeb : styles.panelMobile,
                            {
                                backgroundColor: theme.background?.get() as string,
                                maxHeight,
                                paddingBottom: isWeb ? 24 : insets.bottom + 16,
                            },
                        ]}
                    >
                        {!isWeb && <View style={styles.grabber} />}
                        {(title || isWeb) && (
                            <View style={styles.header}>
                                {title ? (
                                    <Text
                                        fontSize={14}
                                        color="$color11"
                                        textTransform="uppercase"
                                        letterSpacing={1}
                                        fontWeight="600"
                                    >
                                        {title}
                                    </Text>
                                ) : (
                                    <View />
                                )}
                                <TouchableOpacity onPress={onClose} hitSlop={12}>
                                    <IconSymbol name="xmark" size={20} color={theme.color11?.get() as string} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {children}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    overlayWeb: {
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    panel: {
        width: "100%",
    },
    panelMobile: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    panelWeb: {
        maxWidth: 520,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        // @ts-expect-error web
        boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
    },
    grabber: {
        alignSelf: "center",
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: "rgba(255,255,255,0.35)",
        marginTop: 10,
        marginBottom: 8,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 12,
    },
});
