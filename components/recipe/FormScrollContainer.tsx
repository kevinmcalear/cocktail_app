import React from 'react';
import { ScrollViewProps } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

export { dragGripStyle, gripOnly, supportsNestableDrag } from './dragGrip';

/** A page that may hold a nested drag list: on a phone the list needs this container. Web: FormScrollContainer.web.tsx. */
export function FormScrollContainer(props: ScrollViewProps) {
    return <NestableScrollContainer {...props} />;
}
