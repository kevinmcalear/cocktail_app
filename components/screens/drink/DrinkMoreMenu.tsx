import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Body, PressableScale, Sheet, Title, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space, STATUS } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { readableAccent } from '@/lib/color';

import { ReportSheet } from '../safety/ReportSheetLazy';
import { BarButton } from './MaterialBar';

interface DrinkMoreMenuProps {
  itemId: string;
  name: string;
  canEdit: boolean;
  /** A catalog admin on someone else's drink: Fix as admin opens the editor. */
  adminFix?: boolean;
  onEdit: () => void;
  /** Glass ink over the hero (light on sketch paper). */
  scheme?: 'light' | 'dark';
}

/**
 * The More button and its sheet: Report for people who didn't make the drink
 * (App Store 1.2: anything people post can be reported), and Fix as admin for
 * a catalog admin on someone else's drink. Edit and Share have their own
 * buttons; View as lives in Settings (no role switcher on pages, 29 Oct).
 * Nothing when there's nothing to put in it.
 */
export function DrinkMoreMenu({ itemId, name, canEdit, adminFix = false, onEdit, scheme }: DrinkMoreMenuProps) {
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  // What to open once the menu has gone: two sheets never stack. A ref, since the sheet's close was made before the tap.
  const then = useRef<(() => void) | null>(null);
  const [reporting, setReporting] = useState(false);
  const report = signedIn && !canEdit;
  if (!report && !adminFix) return null;
  const parts = [report ? 'report' : null, adminFix ? 'fix as admin' : null].filter(Boolean).join(', ');
  const run = () => {
    const next = then.current;
    then.current = null;
    next?.();
  };

  return (
    <>
      <BarButton accessibilityLabel={`More: ${parts}`} icon="ellipsis" scheme={scheme} onPress={() => setOpen(true)} />
      <Sheet
        visible={open}
        onClose={() => {
          setOpen(false);
          if (Platform.OS !== 'ios') run();
        }}
        onDismiss={run}
        accessibilityLabel="More"
        header={<Header />}
      >
        <ScrollView contentContainerStyle={styles.body}>
          {report ? <Row icon="flag" label={`Report ${name}`} onPick={() => (then.current = () => setReporting(true))} /> : null}
          {adminFix ? <Row icon="lock.shield.fill" label="Fix as admin" onPick={() => (then.current = onEdit)} /> : null}
        </ScrollView>
      </Sheet>
      {reporting ? <ReportSheet subject={name} targets={[{ label: name, target: { kind: 'item', itemId } }]} onClose={() => setReporting(false)} /> : null}
    </>
  );
}

function Header() {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <View style={styles.header}>
      <Title style={styles.flex}>More</Title>
      <PressableScale accessibilityLabel="Close" onPress={close} style={styles.close}>
        <IconSymbol name="xmark" size={18} color={ds.c.muted} />
      </PressableScale>
    </View>
  );
}

/** A row that closes the menu first, then does its thing. */
function Row({ icon, label, danger, onPick }: { icon: IconName; label: string; danger?: boolean; onPick: () => void }) {
  const ds = useDs();
  const close = useSheetClose();
  const tint = danger ? readableAccent(STATUS.danger, ds.c.ground) : undefined;
  return (
    <PressableScale
      role="button"
      accessibilityLabel={label}
      onPress={() => {
        onPick();
        close();
      }}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <IconSymbol name={icon} size={20} color={tint ?? ds.c.ink} />
      <Body color={tint} style={styles.flex}>
        {label}
      </Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  flex: { flex: 1 },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
