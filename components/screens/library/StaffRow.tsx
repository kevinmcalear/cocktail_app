import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Spec, useDs, type IconName } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import type { StaffPick } from '@/hooks/useStaffList';

export interface StaffRowProps {
  pick: StaffPick;
  /** Its place in the ranking, or null for a drink on the list but not ranked. */
  place: number | null;
  /** On menu, Off menu or Past. */
  status: string;
  onOpen: () => void;
  /** Drink Creators and up: the grip, and its controls. */
  canEdit: boolean;
  /** Lifted while being dragged. */
  active?: boolean;
  /** Starts a drag (react-native-draggable-flatlist). Ranked rows only. */
  drag?: () => void;
  /** Desktop web: up and down arrows beside the grip, for keyboards and mice. */
  arrows?: boolean;
  onMove?: (by: -1 | 1) => void;
  first?: boolean;
  last?: boolean;
  onUnrank?: () => void;
  onRank?: () => void;
  onRemove: () => void;
}

/**
 * One drink on the staff list: its place, its name, where it stands with the
 * menus, and for editors a grip. Hold the grip and drag to move it; tap it for buttons that do the same, and screen readers
 * get Move up and Move down as actions.
 */
export function StaffRow({ pick, place, status, onOpen, canEdit, active, drag, arrows, onMove, first, last, onUnrank, onRank, onRemove }: StaffRowProps) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const web = Platform.OS === 'web';
  const caption = pick.classicName && pick.classicName !== pick.name ? pick.classicName : null;
  const label = [place ? `${place}.` : null, pick.name, caption, status].filter(Boolean).join(' ');
  return (
    <View style={[styles.wrap, { borderBottomColor: ds.c.line, backgroundColor: active ? ds.c.raised : ds.c.ground }]}>
      <View style={styles.row}>
        <PressableScale accessibilityLabel={`${label}, open`} onPress={onOpen} style={styles.main}>
          <Spec color={place === 1 ? ds.accentText : ds.c.muted} style={styles.place}>
            {place ?? ''}
          </Spec>
          <View style={styles.name}>
            <Body numberOfLines={2}>{pick.name}</Body>
            {caption ? <Caption tone="muted">{caption}</Caption> : null}
          </View>
          <Caption tone="muted">{status}</Caption>
        </PressableScale>
        {canEdit && arrows && onMove ? (
          <>
            <Icon icon="chevron.up" label={`Move ${pick.name} up`} disabled={first} onPress={() => onMove(-1)} />
            <Icon icon="chevron.down" label={`Move ${pick.name} down`} disabled={last} onPress={() => onMove(1)} />
          </>
        ) : null}
        {canEdit ? (
          <PressableScale
            accessibilityLabel={drag ? `Reorder ${pick.name}` : `Change ${pick.name}`}
            accessibilityHint={drag ? 'Drag to move it, or tap for buttons' : undefined}
            aria-expanded={open}
            accessibilityActions={drag && onMove ? [{ name: 'moveUp', label: 'Move up' }, { name: 'moveDown', label: 'Move down' }] : undefined}
            onAccessibilityAction={(e) => onMove?.(e.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
            // Hold, then drag: a quick tap (or Enter) opens the buttons instead.
            // Web holds for less, since a mouse press is deliberate.
            onLongPress={drag}
            delayLongPress={web ? 150 : 300}
            onPress={() => setOpen(!open)}
            style={[styles.grip, drag && dragGripStyle]}
          >
            <IconSymbol name={drag ? 'line.3.horizontal' : 'ellipsis'} size={20} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>
      {open && canEdit ? (
        <View style={styles.controls}>
          {onMove ? <Button label="Move up" icon="chevron.up" variant="secondary" disabled={first} onPress={() => onMove(-1)} /> : null}
          {onMove ? <Button label="Move down" icon="chevron.down" variant="secondary" disabled={last} onPress={() => onMove(1)} /> : null}
          {onUnrank ? <Button label="Take out of the ranking" variant="ghost" onPress={onUnrank} /> : null}
          {onRank ? <Button label="Rank it" icon="plus" variant="secondary" onPress={onRank} /> : null}
          <Button label="Remove from the list" variant="ghost" onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

function Icon({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled?: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} aria-disabled={disabled} disabled={disabled} onPress={onPress} style={[styles.icon, disabled && styles.off]}>
      <IconSymbol name={icon} size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  place: { width: 22 },
  name: { flex: 1, gap: 2 },
  grip: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.md, paddingLeft: 22 + space.md },
});
