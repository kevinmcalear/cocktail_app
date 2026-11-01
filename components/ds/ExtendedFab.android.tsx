import { ExtendedFloatingActionButton, Host, Icon, Text } from '@expo/ui/jetpack-compose';
import { padding, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';

import { material } from '@/constants/material';
import { space } from '@/constants/tokens';

import { useDs } from './theme';
import type { ExtendedFabProps, FabIcon } from './ExtendedFab';

const ICONS: Record<FabIcon, number> = {
  plus: require('@/assets/icons/android/add.xml'),
  checkmark: require('@/assets/icons/android/check.xml'),
  rank: require('@/assets/icons/android/leaderboard.xml'),
};

/**
 * Android's home for a screen's one main action: Compose's own extended FAB
 * through @expo/ui (And-kit-hybrid-fab, Kevin's pick), so the label's shrink is
 * the system's. Its shadow needs room around it, or the host clips it.
 */
export function ExtendedFab({ label, icon, onPress, accessibilityLabel = label, open = true, colors, style }: ExtendedFabProps) {
  const ds = useDs();
  const fill = colors?.fill ?? ds.accentFill.fill;
  const ink = colors?.text ?? ds.accentFill.text;
  return (
    <View style={[styles.fab, style]}>
      <Host matchContents colorScheme={ds.scheme}>
        <ExtendedFloatingActionButton expanded={open} containerColor={fill} onClick={onPress} modifiers={[padding(SHADOW, SHADOW, SHADOW, SHADOW), semantics({ contentDescription: accessibilityLabel })]}>
          <ExtendedFloatingActionButton.Icon>
            <Icon source={ICONS[icon]} size={24} tint={ink} />
          </ExtendedFloatingActionButton.Icon>
          <ExtendedFloatingActionButton.Text>
            <Text color={ink} style={material.fabText}>
              {label}
            </Text>
          </ExtendedFloatingActionButton.Text>
        </ExtendedFloatingActionButton>
      </Host>
    </View>
  );
}

const SHADOW = space.md;

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg - SHADOW, bottom: space.lg - SHADOW },
});
