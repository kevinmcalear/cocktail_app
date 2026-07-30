import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
    LayoutChangeEvent,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { Text, XStack, useTheme } from 'tamagui';

/** Notion-style cover. position 0 = top of photo, 100 = bottom. */
export function NotionCover({
    uri,
    position = 50,
    maxHeight,
    editing,
    onPositionChange,
    onChangeCover,
}: {
    uri: string;
    position?: number;
    maxHeight: number;
    editing?: boolean;
    onPositionChange?: (pos: number) => void;
    onChangeCover?: () => void;
}) {
    const theme = useTheme();
    const [repositioning, setRepositioning] = useState(false);
    const [boxH, setBoxH] = useState(maxHeight);
    const posRef = useRef(position);
    posRef.current = position;
    const dragStartY = useRef(0);
    const dragStartPos = useRef(position);
    const dragging = useRef(false);
    const boxHRef = useRef(boxH);
    boxHRef.current = boxH;

    const clamped = Math.min(100, Math.max(0, position));

    const applyDelta = (clientY: number) => {
        if (!onPositionChange) return;
        // grab-and-drag: image follows pointer (down → reveal top / lower %)
        const dy = clientY - dragStartY.current;
        const next = dragStartPos.current - (dy / Math.max(1, boxHRef.current)) * 100;
        onPositionChange(Math.min(100, Math.max(0, next)));
    };

    const beginDrag = (clientY: number) => {
        dragging.current = true;
        dragStartY.current = clientY;
        dragStartPos.current = posRef.current;
    };

    return (
        <View
            style={[styles.cover, { maxHeight }, repositioning && styles.repositioning]}
            onLayout={(e: LayoutChangeEvent) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0) setBoxH(h);
            }}
        >
            <Image
                source={{ uri }}
                style={styles.image}
                contentFit="cover"
                contentPosition={{ left: '50%', top: `${clamped}%` }}
            />

            <View
                style={StyleSheet.absoluteFill}
                onStartShouldSetResponder={() => repositioning}
                onMoveShouldSetResponder={() => repositioning}
                onResponderGrant={(e) => beginDrag(e.nativeEvent.pageY)}
                onResponderMove={(e) => {
                    if (dragging.current) applyDelta(e.nativeEvent.pageY);
                }}
                onResponderRelease={() => {
                    dragging.current = false;
                }}
                onResponderTerminate={() => {
                    dragging.current = false;
                }}
                {...(Platform.OS === 'web'
                    ? ({
                          draggable: false,
                          onDragStart: (e: any) => e?.preventDefault?.(),
                          onMouseDown: (e: any) => {
                              if (!repositioning) return;
                              e.preventDefault();
                              beginDrag(e.clientY);
                              const move = (ev: MouseEvent) => {
                                  if (dragging.current) applyDelta(ev.clientY);
                              };
                              const up = () => {
                                  dragging.current = false;
                                  window.removeEventListener('mousemove', move);
                                  window.removeEventListener('mouseup', up);
                              };
                              window.addEventListener('mousemove', move);
                              window.addEventListener('mouseup', up);
                          },
                      } as any)
                    : {})}
            />

            {editing ? (
                <XStack style={styles.toolbar} gap="$2">
                    {repositioning ? (
                        <Pressable
                            onPress={() => setRepositioning(false)}
                            style={[styles.btn, { backgroundColor: theme.backgroundStrong?.get() as string }]}
                        >
                            <Text fontSize={12} fontWeight="600" color="$color">
                                Done
                            </Text>
                        </Pressable>
                    ) : (
                        <>
                            <Pressable
                                onPress={onChangeCover}
                                style={[styles.btn, { backgroundColor: theme.backgroundStrong?.get() as string }]}
                            >
                                <IconSymbol name="photo" size={12} color={theme.color?.get() as string} />
                                <Text fontSize={12} fontWeight="600" color="$color">
                                    Change cover
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setRepositioning(true)}
                                style={[styles.btn, { backgroundColor: theme.backgroundStrong?.get() as string }]}
                            >
                                <IconSymbol name="arrow.up.and.down" size={12} color={theme.color?.get() as string} />
                                <Text fontSize={12} fontWeight="600" color="$color">
                                    Reposition
                                </Text>
                            </Pressable>
                        </>
                    )}
                </XStack>
            ) : null}

            {repositioning ? (
                <View style={styles.hint} pointerEvents="none">
                    <Text fontSize={12} fontWeight="600" color="#fff">
                        Drag to reposition
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    cover: {
        width: '100%',
        aspectRatio: 5 / 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(127,127,127,0.12)',
        userSelect: 'none',
    } as any,
    repositioning: {
        cursor: 'grab',
    } as any,
    image: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
    },
    toolbar: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 2,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 6,
        opacity: 0.95,
    },
    hint: {
        position: 'absolute',
        bottom: 12,
        alignSelf: 'center',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 2,
    },
});
