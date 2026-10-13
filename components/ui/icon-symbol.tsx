// Line icons on Android and web (iOS draws SF Symbols, icon-symbol.ios.tsx).

import Feather from '@expo/vector-icons/Feather';
import type { SFSymbol, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { type ColorValue, type StyleProp, type TextStyle, Platform, Text } from 'react-native';

import { useIsHydrated } from '@/hooks/useIsHydrated';

import { LineGlyph, type LineGlyphName } from './lineGlyphs';

type IconMapping = Partial<Record<SFSymbol, ComponentProps<typeof Feather>['name'] | `svg:${LineGlyphName}`>>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbol names to line icons, the canvas's icon style: Feather (see
 * https://icons.expo.fyi), or `svg:` for the few Feather lacks (lineGlyphs).
 * Filled SF names map to the same line icon: the canvas draws no filled ones.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'chevron-up',
  'chevron.down': 'chevron-down',
  'xmark.circle.fill': 'x-circle',
  'plus': 'plus',
  'minus': 'minus',
  'plus.circle.fill': 'plus-circle',
  'trash': 'trash-2',
  'xmark': 'x',
  'arrow.clockwise': 'refresh-cw',
  'clock.arrow.circlepath': 'rotate-ccw',
  'pencil': 'edit-2',
  'heart': 'heart',
  'heart.fill': 'heart',
  'book': 'book-open',
  'book.fill': 'book-open',
  'hammer.fill': 'tool',
  'wineglass': 'svg:wineglass',
  'wineglass.fill': 'svg:wineglass',
  'mug.fill': 'svg:beer',
  'snowflake': 'svg:snowflake',
  'leaf.fill': 'svg:leaf',
  'person.2.fill': 'users',
  'person.badge.plus': 'user-plus',
  'person.badge.minus': 'user-minus',
  'envelope': 'mail',
  'key.fill': 'key',
  'person': 'user',
  'globe': 'globe',
  'note.text': 'file-text',
  'checkmark': 'check',
  'questionmark': 'help-circle',
  'checkmark.circle.fill': 'check-circle',
  'house': 'home',
  'safari': 'compass',
  'bookmark': 'bookmark',
  'bookmark.fill': 'bookmark',
  'calendar': 'calendar',
  'person.crop.circle': 'user',
  'folder.fill': 'folder',
  'tag.fill': 'tag',
  'person.circle.fill': 'user',
  'building.2.fill': 'svg:building',
  'building.2': 'svg:building',
  'plus.circle': 'plus-circle',
  'play.fill': 'play',
  'flask': 'svg:flask',
  'line.3.horizontal': 'menu',
  'circle.grid.3x3.fill': 'svg:grip',
  'line.3.horizontal.decrease': 'filter',
  'camera.fill': 'camera',
  'photo': 'image',
  'circle.lefthalf.filled': 'moon',
  'rectangle.portrait.and.arrow.right': 'log-out',
  'magnifyingglass': 'search',
  'plus.magnifyingglass': 'zoom-in',
  'minus.magnifyingglass': 'zoom-out',
  'arrow.up': 'arrow-up',
  'arrow.right': 'arrow-right',
  'arrow.up.and.down': 'svg:updown',
  '8.circle': 'svg:eightball',
  'list.bullet': 'list',
  'percent': 'percent',
  'drop.fill': 'droplet',
  'sparkles': 'svg:sparkles',
  // The flavor map's target ring (prep-flavor-entry).
  'target': 'target',
  'ellipsis': 'more-horizontal',
  'dollarsign.circle.fill': 'dollar-sign',
  'mappin.and.ellipse': 'map-pin',
  'square.and.arrow.up': 'share',
  'plus.square': 'plus-square',
  'link': 'link',
  'doc.on.doc': 'copy',
  'paintpalette.fill': 'svg:palette',
  'map.fill': 'map',
  'clock': 'clock',
  'phone': 'phone',
  'arrow.triangle.turn.up.right.diamond': 'navigation-2',
  'lock.shield.fill': 'shield',
  'lock.fill': 'lock',
  'lock.open.fill': 'unlock',
  'star': 'star',
  'info.circle': 'info',
  'exclamationmark.circle': 'alert-circle',
  'eye': 'eye',
  'eye.slash': 'eye-off',
  'nosign': 'slash',
  'hand.tap': 'mouse-pointer',
  'exclamationmark.triangle': 'alert-triangle',
  'doc.text': 'svg:draft',
  'doc': 'svg:sheet',
  'doc.plaintext': 'file',
  'circle.fill': 'svg:dot',
  'sun.max.fill': 'sun',
  'list.number': 'list',
  'trophy': 'award',
  'line.horizontal.3': 'menu',
  'location': 'map-pin',
  'flag': 'flag',
  'gearshape': 'settings',
  'slider.horizontal.3': 'sliders',
  // Menus: the R&D tile, printing, and a builder row's ... menu.
  'square.grid.2x2': 'grid',
  'printer': 'printer',
  'arrow.up.to.line': 'chevrons-up',
  'arrow.up.right.square': 'external-link',
  'arrow.turn.down.right': 'corner-down-right',
  'square.on.square': 'layers',
  'pin': 'svg:pin',
  'pin.fill': 'svg:pin',
  'arrow.up.right': 'arrow-up-right',
  'checkmark.seal.fill': 'svg:seal',
  'rectangle.stack': 'layers',
  'camera': 'camera',
  'doc.on.clipboard': 'clipboard',
  'arrow.uturn.backward': 'corner-up-left',
  'square.and.arrow.down': 'svg:tray',
  'text.alignleft': 'svg:lines',
  'sun.min': 'svg:sun',
} satisfies IconMapping;

/**
 * An icon: native SF Symbols on iOS, line icons on Android and web.
 * Icon `name`s are SF Symbols and need a line icon in MAPPING.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Android's back affordance is an arrow, not the iOS chevron (every
  // chevron.left in the app is a back button).
  const glyph = name === 'chevron.left' && Platform.OS === 'android' ? 'arrow-left' : MAPPING[name];
  // Web static render: the icon font is never loaded on the server, so
  // Feather renders an empty <Text />. On the client it may already be
  // loaded and draw the glyph, which breaks hydration. Render the same empty
  // Text until hydration is done.
  const isHydrated = useIsHydrated();
  if (!isHydrated) return <Text />;
  if (glyph.startsWith('svg:')) return <LineGlyph name={glyph.slice(4) as LineGlyphName} size={size} color={color} />;
  return <Feather color={color as ComponentProps<typeof Feather>['color']} size={size} name={glyph as ComponentProps<typeof Feather>['name']} style={style} />;
}
