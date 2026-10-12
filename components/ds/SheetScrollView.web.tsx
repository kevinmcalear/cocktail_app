// The web's sheets don't drag, so their body is a plain ScrollView, without
// the Reanimated and Gesture Handler code the drag runs on (useSheetDrag).
export { ScrollView as SheetScrollView } from 'react-native';
