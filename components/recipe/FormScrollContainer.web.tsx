import React from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';

export { dragGripStyle, gripOnly, supportsNestableDrag } from './dragGrip';

/** Web drag lists aren't nested, so a plain ScrollView, and no draggable-flatlist (Reanimated) in web's common chunk. */
export function FormScrollContainer(props: ScrollViewProps) {
    return <ScrollView {...props} />;
}
