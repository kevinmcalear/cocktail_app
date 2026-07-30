import { CurrentMenuList } from "@/components/CurrentMenuList";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBars } from "@/hooks/useBars";
import { useDrafts } from "@/hooks/useDrafts";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useAppStore } from "@/store/useAppStore";
import { useRecentActivityStore } from "@/store/useRecentActivityStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, XStack, YStack, useTheme } from "tamagui";

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;
    const { isEditModeEnabled } = useSettingsStore();
    const selectedMenuId = useAppStore((s) => s.selectedMenuId);
    const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);
    const pushRecent = useRecentActivityStore((s) => s.push);

    const { data: dropdowns, isLoading: loadingMenus, refetch } = useDropdowns();
    const { data: userBars } = useBars();
    const { drafts } = useDrafts();
    const menus = dropdowns?.menus || [];

    const [pickerOpen, setPickerOpen] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    useEffect(() => {
        if (menus.length === 0) return;
        const stillValid = selectedMenuId && menus.some((m) => m.id === selectedMenuId);
        if (!stillValid) {
            setSelectedMenuId(menus[menus.length - 1].id);
        }
    }, [menus, selectedMenuId, setSelectedMenuId]);

    const barNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const ub of userBars || []) {
            const bar = (ub as any).bars;
            if (bar?.id) map.set(bar.id, bar.name);
        }
        return map;
    }, [userBars]);

    const selectMenu = (menu: { id: string; name: string; bar_id?: string | null; cover_url?: string | null }) => {
        setSelectedMenuId(menu.id);
        setPickerOpen(false);
        pushRecent({
            id: menu.id,
            kind: "menu",
            title: menu.name,
            subtitle: "Menu",
            href: "/(tabs)/menus",
            barId: menu.bar_id ?? null,
            imageUrl: menu.cover_url ?? null,
        });
    };

    const { data: menuDetails, isLoading: loadingDetails } = useMenuDetails(selectedMenuId);
    const selectedMenu = menus.find((m) => m.id === selectedMenuId) ?? null;
    const selectedCoverUrl = selectedMenu?.cover_url ?? null;
    const venueName = selectedMenu?.bar_id ? barNameById.get(selectedMenu.bar_id) : null;

    const menuDrafts = useMemo(
        () => drafts.filter((d: any) => d.entity_type === "menu" && !d.isPublished),
        [drafts]
    );

    const menusByVenue = useMemo(() => {
        const groups = new Map<string, { label: string; menus: typeof menus }>();
        for (const menu of menus) {
            const key = menu.bar_id || "__none__";
            const label = (menu.bar_id && barNameById.get(menu.bar_id)) || "Menus";
            if (!groups.has(key)) groups.set(key, { label, menus: [] });
            groups.get(key)!.menus.push(menu);
        }
        return Array.from(groups.values());
    }, [menus, barNameById]);

    const cover = (
        <View
            style={[
                styles.coverFrame,
                isWide ? styles.coverWide : styles.coverPhone,
                { backgroundColor: theme.backgroundStrong?.get() as string },
            ]}
        >
            {selectedCoverUrl ? (
                <Image source={{ uri: selectedCoverUrl }} style={styles.coverImage} contentFit="cover" />
            ) : (
                <View style={styles.coverEmpty}>
                    <CustomIcon name="TabMenus" size={isWide ? 64 : 48} color={theme.color11?.get() as string} />
                </View>
            )}
        </View>
    );

    const titleBlock = (
        <YStack flex={1} gap="$1" minWidth={0}>
            {menus.length > 1 ? (
                <TouchableOpacity onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
                    <XStack alignItems="center" gap="$2">
                        <Text
                            fontSize={isWide ? 40 : 28}
                            lineHeight={isWide ? 46 : 34}
                            fontFamily="IBMPlexSansItalic"
                            fontStyle="italic"
                            color="$color"
                            numberOfLines={2}
                            flexShrink={1}
                        >
                            {selectedMenu?.name || "Menus"}
                        </Text>
                        <IconSymbol name="chevron.down" size={18} color={theme.color11?.get() as string} />
                    </XStack>
                </TouchableOpacity>
            ) : (
                <Text
                    fontSize={isWide ? 40 : 28}
                    lineHeight={isWide ? 46 : 34}
                    fontFamily="IBMPlexSansItalic"
                    fontStyle="italic"
                    color="$color"
                    numberOfLines={2}
                >
                    {selectedMenu?.name || (loadingMenus ? "Loading…" : "No menus yet")}
                </Text>
            )}
            {venueName ? (
                <Text fontSize={14} color="$color11" numberOfLines={1}>
                    {venueName}
                </Text>
            ) : null}
            {loadingDetails ? (
                <ActivityIndicator color={theme.color8?.get() as string} style={{ alignSelf: "flex-start", marginTop: 8 }} />
            ) : null}
        </YStack>
    );

    const headerActions = isEditModeEnabled ? (
        <XStack alignItems="center" gap="$1">
            {selectedMenu ? (
                <TouchableOpacity
                    onPress={() =>
                        router.push({ pathname: "/menus/create", params: { menuId: selectedMenu.id } })
                    }
                    style={{ padding: 8 }}
                >
                    <Text color={theme.color8?.get() as string} fontWeight="bold" fontSize={16}>
                        Edit
                    </Text>
                </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setActionsOpen(true)} style={{ padding: 8 }}>
                <IconSymbol name="ellipsis" size={22} color={theme.color?.get() as string} />
            </TouchableOpacity>
        </XStack>
    ) : null;

    const header = isWide ? (
        <XStack paddingTop={insets.top + 24} paddingHorizontal={24} paddingBottom={8} gap={28} alignItems="flex-start">
            {cover}
            <YStack flex={1} paddingTop={12} gap="$3" minWidth={0}>
                <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
                    {titleBlock}
                    {headerActions}
                </XStack>
            </YStack>
        </XStack>
    ) : (
        <YStack paddingTop={insets.top}>
            {cover}
            <XStack
                paddingHorizontal={20}
                paddingTop={20}
                paddingBottom={4}
                alignItems="flex-start"
                justifyContent="space-between"
                gap="$3"
            >
                {titleBlock}
                {headerActions}
            </XStack>
        </YStack>
    );

    if (!loadingMenus && menus.length === 0) {
        return (
            <YStack flex={1} backgroundColor="$background" paddingTop={insets.top + 40} paddingHorizontal={24} gap="$4">
                <Text
                    fontSize={32}
                    fontFamily="IBMPlexSansItalic"
                    fontStyle="italic"
                    color="$color"
                >
                    Menus
                </Text>
                <Text color="$color11" fontSize={15}>
                    No menus yet. Create one to start building your list.
                </Text>
                {isEditModeEnabled ? (
                    <TouchableOpacity
                        onPress={() => router.push("/menus/create")}
                        style={[styles.primaryBtn, { backgroundColor: theme.color8?.get() as string }]}
                    >
                        <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold" fontSize={16}>
                            New Menu
                        </Text>
                    </TouchableOpacity>
                ) : null}
                {menuDrafts.length > 0 ? (
                    <YStack gap="$2" marginTop="$4">
                        <Text fontSize={11} fontWeight="600" color="$color11" textTransform="uppercase" letterSpacing={0.8}>
                            Drafts
                        </Text>
                        {menuDrafts.map((d: any) => (
                            <Pressable
                                key={d.id}
                                onPress={() =>
                                    router.push({ pathname: "/menus/create", params: { draftId: d.id } })
                                }
                                style={[styles.pickerRow, { borderBottomColor: theme.borderColor?.get() as string }]}
                            >
                                <Text color="$color" fontSize={16} fontWeight="500">
                                    {d.draft_data?.menuName || d.draft_data?.name || "Untitled Menu"}
                                </Text>
                                <Text color="$color11" fontSize={12}>
                                    Draft
                                </Text>
                            </Pressable>
                        ))}
                    </YStack>
                ) : null}
            </YStack>
        );
    }

    return (
        <YStack flex={1} backgroundColor="$background">
            <CurrentMenuList
                sections={menuDetails?.sections || []}
                ListHeaderComponent={header}
            />

            <AdaptiveSheetModal visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Menus">
                <YStack paddingHorizontal="$4" gap="$1">
                    {menusByVenue.map((group) => (
                        <YStack key={group.label} gap="$1" marginBottom="$3">
                            {menusByVenue.length > 1 ? (
                                <Text
                                    fontSize={11}
                                    fontWeight="600"
                                    color="$color11"
                                    textTransform="uppercase"
                                    letterSpacing={0.8}
                                    marginBottom="$1"
                                >
                                    {group.label}
                                </Text>
                            ) : null}
                            {group.menus.map((menu) => {
                                const selected = menu.id === selectedMenuId;
                                return (
                                    <Pressable
                                        key={menu.id}
                                        onPress={() => selectMenu(menu)}
                                        style={[
                                            styles.pickerRow,
                                            {
                                                borderBottomColor: theme.borderColor?.get() as string,
                                                backgroundColor: selected ? "rgba(255,255,255,0.06)" : "transparent",
                                            },
                                        ]}
                                    >
                                        <Text color="$color" fontSize={16} fontWeight={selected ? "700" : "500"}>
                                            {menu.name}
                                        </Text>
                                        {selected ? (
                                            <IconSymbol
                                                name="checkmark"
                                                size={18}
                                                color={theme.color8?.get() as string}
                                            />
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </YStack>
                    ))}

                    {menuDrafts.length > 0 ? (
                        <YStack gap="$1" marginTop="$2">
                            <Text
                                fontSize={11}
                                fontWeight="600"
                                color="$color11"
                                textTransform="uppercase"
                                letterSpacing={0.8}
                                marginBottom="$1"
                            >
                                Drafts
                            </Text>
                            {menuDrafts.map((d: any) => (
                                <Pressable
                                    key={d.id}
                                    onPress={() => {
                                        setPickerOpen(false);
                                        router.push({ pathname: "/menus/create", params: { draftId: d.id } });
                                    }}
                                    style={[styles.pickerRow, { borderBottomColor: theme.borderColor?.get() as string }]}
                                >
                                    <Text color="$color" fontSize={16} fontWeight="500">
                                        {d.draft_data?.menuName || d.draft_data?.name || "Untitled Menu"}
                                    </Text>
                                    <Text color="$color11" fontSize={12}>
                                        Resume
                                    </Text>
                                </Pressable>
                            ))}
                        </YStack>
                    ) : null}
                </YStack>
            </AdaptiveSheetModal>

            <AdaptiveSheetModal visible={actionsOpen} onClose={() => setActionsOpen(false)} title="Menu">
                <YStack paddingHorizontal="$4">
                    <Pressable
                        onPress={() => {
                            setActionsOpen(false);
                            router.push("/menus/create");
                        }}
                        style={[styles.pickerRow, { borderBottomColor: theme.borderColor?.get() as string }]}
                    >
                        <Text color="$color" fontSize={16} fontWeight="600">
                            New Menu
                        </Text>
                    </Pressable>
                    {selectedMenu ? (
                        <Pressable
                            onPress={() => {
                                setActionsOpen(false);
                                router.push({
                                    pathname: "/menus/create",
                                    params: { menuId: selectedMenu.id },
                                });
                            }}
                            style={[styles.pickerRow, { borderBottomColor: theme.borderColor?.get() as string }]}
                        >
                            <Text color="$color" fontSize={16} fontWeight="600">
                                Edit Menu
                            </Text>
                        </Pressable>
                    ) : null}
                </YStack>
            </AdaptiveSheetModal>
        </YStack>
    );
}

const styles = StyleSheet.create({
    coverFrame: {
        borderRadius: 24,
        overflow: "hidden",
    },
    coverPhone: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 0,
    },
    coverWide: {
        width: "38%",
        maxWidth: 360,
        minWidth: 240,
        aspectRatio: 1,
    },
    coverImage: {
        width: "100%",
        height: "100%",
    },
    coverEmpty: {
        width: "100%",
        height: "100%",
    },
    pickerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 4,
        borderRadius: 8,
    },
    primaryBtn: {
        alignSelf: "flex-start",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 999,
    },
});
