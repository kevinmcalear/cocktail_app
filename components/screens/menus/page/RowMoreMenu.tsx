import { useEffect, useRef, type ComponentRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { PressableScale, useDs } from '@/components/ds';
import { PopoverMenu, usePopover } from '@/components/ds/PopoverMenu';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout } from '@/constants/tokens';

import type { Act, ActKind } from './liveList';

/**
 * A drink row's …, and the menu it opens over the row (Kevin, 4 Nov: "a
 * more options ... kind of mini menu that you click to open on top of each
 * drink, like best practices on ios"): the row's acts in their order, Swap,
 * Take off, Off tonight, Approve, Turn down. The pull-down is the app's own
 * (PopoverMenu: glass on iOS, blurred on the web, solid on Android), and
 * Android draws the … upright (IconSymbol). Only the team's menu page loads
 * it, never the guest's (B13).
 */
export function RowMoreMenu({ name, acts, onAct }: { name: string; acts: Act[]; onAct: (kind: ActKind) => void }) {
  const ds = useDs();
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  // iOS can't put up a sheet while the menu's own Modal is still going: Swap's sheet waits for it.
  // ponytail: a fixed wait; PopoverMenu unmounts its Modal, so there is no onDismiss to wait on.
  // Only the acts that put up a sheet wait; Off tonight and the rest act at once.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pick = (kind: ActKind) => {
    if (Platform.OS === 'ios' && (kind === 'swap' || kind === 'takeOff')) timer.current = setTimeout(() => onAct(kind), 350);
    else onAct(kind);
  };
  return (
    <View ref={button} collapsable={false}>
      <PressableScale role="button" aria-haspopup="menu" aria-expanded={!!menu.anchor} accessibilityLabel={`More for ${name}`} onPress={() => menu.open(button.current)} style={styles.button}>
        <IconSymbol name="ellipsis" size={20} color={ds.c.muted} />
      </PressableScale>
      <PopoverMenu anchor={menu.anchor} label={`More for ${name}`} onClose={menu.close} sections={[{ items: acts.map((a) => ({ label: a.label, onPress: () => pick(a.kind) })) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
