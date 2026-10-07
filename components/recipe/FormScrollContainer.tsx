import React from 'react';
import { Platform, ScrollView, ScrollViewProps, ViewStyle } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

type FormScrollContainerProps = ScrollViewProps;

export function FormScrollContainer(props: FormScrollContainerProps) {
    if (Platform.OS === 'web') {
        return <ScrollView {...props} />;
    }
    return <NestableScrollContainer {...props} />;
}

export const supportsNestableDrag = Platform.OS !== 'web';

/**
 * On a drag handle: on web, a touch here drags instead of scrolling the page.
 * Drag lists let the browser scroll everywhere else (our draggable-flatlist patch).
 */
export const dragGripStyle = Platform.OS === 'web' ? ({ touchAction: 'none' } as ViewStyle) : null;

/**
 * A drag list's `dragHitSlop` when its grip is the first `width` points of a row:
 * only a touch there can start the drag pan. Over the whole row the pan took every
 * vertical swipe on Android, so the page wouldn't scroll over the list.
 */
export const gripOnly = (width: number) => ({ left: 0, width });
