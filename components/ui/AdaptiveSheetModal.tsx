import React from "react";
import { StyleSheet, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, useTheme } from "tamagui";

import { Sheet, sheetIsDialog, useSheetClose } from "@/components/ds";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface AdaptiveSheetModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: ViewStyle["maxHeight"];
    /** Called once the sheet is on screen. */
    onShow?: () => void;
}

/** The older screens' titled sheet, on the app's one Sheet (components/ds/Sheet). */
export function AdaptiveSheetModal({
    visible,
    onClose,
    title,
    children,
    maxHeight = "70%",
    onShow,
}: AdaptiveSheetModalProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            onShow={onShow}
            accessibilityLabel={title ?? "Sheet"}
            keyboard
            style={{
                backgroundColor: theme.background?.get() as string,
                maxHeight,
                paddingBottom: sheetIsDialog ? 24 : insets.bottom + 16,
            }}
            header={<Header title={title} color={theme.color11?.get() as string} />}
        >
            {children}
        </Sheet>
    );
}

function Header({ title, color }: { title?: string; color: string }) {
    const close = useSheetClose();
    return (
        <View style={styles.header}>
            {title ? (
                <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">
                    {title}
                </Text>
            ) : (
                <View />
            )}
            <TouchableOpacity onPress={close} hitSlop={12} role="button" accessibilityLabel="Close">
                <IconSymbol name="xmark" size={20} color={color} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 12,
    },
});
