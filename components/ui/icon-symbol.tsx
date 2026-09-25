// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SFSymbol, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle, Platform } from 'react-native';

type IconMapping = Partial<Record<SFSymbol, ComponentProps<typeof MaterialIcons>['name']>>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'xmark.circle.fill': 'cancel',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'trash': 'delete',
  'xmark': 'close',
  'pencil': 'edit',
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'book': 'menu-book',
  'book.fill': 'menu-book',
  'hammer.fill': 'build',
  'wineglass': 'wine-bar',
  'wineglass.fill': 'wine-bar',
  'mug.fill': 'sports-bar',
  'snowflake': 'ac-unit',
  'leaf.fill': 'eco',
  'person.2.fill': 'group',
  'person': 'person',
  'globe': 'public',
  'note.text': 'notes',
  'checkmark': 'check',
  'folder.fill': 'folder',
  'tag.fill': 'local-offer',
  'person.circle.fill': 'account-circle',
  'building.2.fill': 'business',
  'building.2': 'business',
  'plus.circle': 'add-circle-outline',
  'play.fill': 'play-arrow',
  'flask': 'science',
  'line.3.horizontal': 'drag-handle',
  'line.3.horizontal.decrease': 'sort',
  'camera.fill': 'photo-camera',
  'photo': 'photo',
  'circle.lefthalf.filled': 'brightness-6',
  'rectangle.portrait.and.arrow.right': 'logout',
  'magnifyingglass': 'search',
  'arrow.up': 'arrow-upward',
  'arrow.up.and.down': 'swap-vert',
  'square.grid.2x2': 'grid-view',
  'list.bullet': 'format-list-bulleted',
  'percent': 'percent',
  'drop.fill': 'water-drop',
  'sparkles': 'auto-awesome',
  'ellipsis': 'more-horiz',
  'dollarsign.circle.fill': 'monetization-on',
  'mappin.and.ellipse': 'place',
  'square.and.arrow.up': 'ios-share',
  'plus.square': 'add-box',
  'link': 'link',
  'doc.on.doc': 'content-copy',
  'map.fill': 'map',
  'lock.shield.fill': 'security',
  'info.circle': 'info-outline',
  'hand.tap': 'touch-app',
  'exclamationmark.triangle': 'warning-amber',
  'doc.text': 'description',
  'doc.plaintext': 'article',
  'circle.fill': 'circle',
  'sun.max.fill': 'wb-sunny',
} satisfies IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Android's back affordance is an arrow, not the iOS chevron (every
  // chevron.left in the app is a back button).
  const glyph = name === 'chevron.left' && Platform.OS === 'android' ? 'arrow-back' : MAPPING[name];
  return <MaterialIcons color={color} size={size} name={glyph} style={style} />;
}
