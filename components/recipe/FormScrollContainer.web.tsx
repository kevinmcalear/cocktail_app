import React, { type ComponentProps } from 'react';
import { ScrollView } from 'react-native';

export { dragGripStyle, gripOnly, supportsNestableDrag } from './dragGrip';

/** Web drag lists aren't nested, so a plain ScrollView, and no draggable-flatlist (Reanimated) in web's common chunk. */
export function FormScrollContainer(props: ComponentProps<typeof ScrollView>) {
    return <ScrollView {...props} />;
}
