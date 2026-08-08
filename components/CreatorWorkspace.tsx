import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { calculateDraftProgress } from '@/lib/draftProgress';
import { capitalize } from '@/lib/stringUtils';
import { WorkspaceFrame } from '@/lib/creatorWorkspaceUtils';

interface CreatorWorkspaceProps {
    navigationStack: WorkspaceFrame[];
    activeItem: any | null;
    workspaceMeta?: { type: string; name: string } | null;
    drafts: any[];
    dropdowns: any;
    onNavigateToFrame: (index: number) => void;
    onDiscard?: () => void;
    onCancel?: () => void;
    onSave?: () => void;
    onPublish?: () => void;
    saving?: boolean;
    isDirty?: boolean;
    canPublish?: boolean;
    children: React.ReactNode;
}

export function CreatorWorkspace({
    navigationStack,
    activeItem,
    workspaceMeta = null,
    drafts,
    dropdowns,
    onNavigateToFrame,
    onDiscard,
    onCancel,
    onSave,
    onPublish,
    saving = false,
    isDirty = false,
    canPublish = false,
    children,
}: CreatorWorkspaceProps) {
    const theme = useTheme();
    const showBreadcrumbs = navigationStack.length > 1;
    const draftPublishChrome = Boolean(onPublish);

    const progressInfo = activeItem && !activeItem.isPublished
        ? calculateDraftProgress(activeItem, drafts, dropdowns)
        : null;

    const lastSaved = activeItem?.updated_at
        ? new Date(activeItem.updated_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : null;

    const entityType = activeItem?.entity_type ?? workspaceMeta?.type;
    const showHeader = showBreadcrumbs || activeItem || workspaceMeta || !!onCancel;

    return (
        <YStack flex={1} height="100%" backgroundColor="$background">
            {showHeader && (
                <YStack
                    borderBottomWidth={1}
                    borderBottomColor="$borderColor"
                    backgroundColor="$backgroundStrong"
                >
                    {showBreadcrumbs && (
                        <ScrollableBreadcrumbs
                            stack={navigationStack}
                            onNavigateToFrame={onNavigateToFrame}
                        />
                    )}

                    {(activeItem || workspaceMeta || onCancel) && (
                        <XStack
                            paddingHorizontal="$4"
                            paddingVertical="$2.5"
                            alignItems="center"
                            justifyContent="space-between"
                            gap="$3"
                        >
                            <XStack alignItems="center" gap="$2" flex={1} flexWrap="wrap">
                                {onCancel && (
                                    <TouchableOpacity
                                        onPress={onCancel}
                                        style={styles.backBtn}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <IconSymbol
                                            name="chevron.left"
                                            size={20}
                                            color={theme.color?.get() as string}
                                        />
                                    </TouchableOpacity>
                                )}
                                {activeItem?.isPublished ? (
                                    <View style={[styles.badge, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                                        <XStack alignItems="center" gap="$1">
                                            <IconSymbol name="checkmark" size={10} color="#34C759" />
                                            <Text fontSize={10} fontWeight="bold" color="#34C759" textTransform="uppercase">
                                                Published
                                            </Text>
                                        </XStack>
                                    </View>
                                ) : progressInfo ? (
                                    <View style={[styles.badge, { backgroundColor: progressInfo.badgeBg, borderColor: progressInfo.color, borderWidth: 1 }]}>
                                        <Text fontSize={10} fontWeight="bold" color={progressInfo.badgeText} textTransform="uppercase">
                                            Draft · {progressInfo.percentage}%
                                        </Text>
                                    </View>
                                ) : workspaceMeta ? (
                                    <View style={[styles.badge, { backgroundColor: theme.color5?.get() as string }]}>
                                        <Text fontSize={9} fontWeight="bold" color="$color11" textTransform="uppercase">
                                            Venue
                                        </Text>
                                    </View>
                                ) : null}

                                {entityType && entityType !== 'bar' && (
                                    <View style={[styles.badge, { backgroundColor: theme.color5?.get() as string }]}>
                                        <Text fontSize={9} fontWeight="bold" color="$color11" textTransform="uppercase">
                                            {entityType}
                                        </Text>
                                    </View>
                                )}

                                {lastSaved && (
                                    <Text fontSize={11} color="$color11">
                                        Saved {lastSaved}
                                    </Text>
                                )}
                                {workspaceMeta && !lastSaved && (
                                    <Text fontSize={13} fontWeight="600" color="$color" numberOfLines={1}>
                                        {workspaceMeta.name}
                                    </Text>
                                )}
                            </XStack>

                            <XStack alignItems="center" gap="$2">
                                {onDiscard && (
                                    <TouchableOpacity onPress={onDiscard} style={styles.discardBtn}>
                                        <XStack alignItems="center" gap="$1">
                                            <IconSymbol name="trash" size={12} color="#ff4444" />
                                            <Text fontSize={11} fontWeight="600" color="#ff4444">
                                                {draftPublishChrome || activeItem?.isPublished ? "Delete" : "Discard"}
                                            </Text>
                                        </XStack>
                                    </TouchableOpacity>
                                )}
                                {onSave && (
                                    <TouchableOpacity
                                        onPress={onSave}
                                        disabled={saving || !isDirty}
                                        style={[styles.saveBtn, { backgroundColor: theme.color8?.get() as string, opacity: isDirty ? 1 : 0.4 }]}
                                    >
                                        <Text fontSize={12} fontWeight="bold" color={theme.backgroundStrong?.get() as string}>
                                            {saving ? "Saving…" : draftPublishChrome ? "Save Draft" : "Save"}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {onPublish && (
                                    <TouchableOpacity
                                        onPress={onPublish}
                                        disabled={saving || !canPublish}
                                        style={[styles.saveBtn, { backgroundColor: theme.color8?.get() as string, opacity: canPublish ? 1 : 0.4 }]}
                                    >
                                        <Text fontSize={12} fontWeight="bold" color={theme.backgroundStrong?.get() as string}>
                                            {saving ? "…" : "Publish"}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </XStack>
                        </XStack>
                    )}
                </YStack>
            )}

            <YStack flex={1} minHeight={0}>
                {children}
            </YStack>
        </YStack>
    );
}

function ScrollableBreadcrumbs({
    stack,
    onNavigateToFrame,
}: {
    stack: WorkspaceFrame[];
    onNavigateToFrame: (index: number) => void;
}) {
    const theme = useTheme();

    return (
        <XStack
            paddingHorizontal="$4"
            paddingTop="$3"
            paddingBottom="$2"
            alignItems="center"
            gap="$1"
            flexWrap="wrap"
        >
            {stack.map((frame, index) => {
                const isLast = index === stack.length - 1;
                const label = capitalize(frame.node.name);

                return (
                    <XStack key={`${frame.node.id}-${index}`} alignItems="center" gap="$1">
                        {index > 0 && (
                            <IconSymbol name="chevron.right" size={10} color={theme.color11?.get() as string} />
                        )}
                        {isLast ? (
                            <Text fontSize={13} fontWeight="600" color="$color" numberOfLines={1}>
                                {label}
                            </Text>
                        ) : (
                            <TouchableOpacity onPress={() => onNavigateToFrame(index)}>
                                <Text fontSize={13} color="$color8" fontWeight="500" numberOfLines={1}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </XStack>
                );
            })}
        </XStack>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    discardBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 68, 68, 0.08)',
    },
    backBtn: {
        paddingHorizontal: 4,
        paddingVertical: 4,
        marginRight: 2,
    },
    saveBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 6,
    },
});
