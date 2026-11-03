import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Body, PressableScale, Sheet, Title, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space, STATUS } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { readableAccent } from '@/lib/color';

import { ReportSheet } from '../safety/ReportSheetLazy';
import { BarButton } from './MaterialBar';

/** What a page's More holds (Kevin, 3 Nov: "everything including edit and share and bookmark" under the …). */
export interface ItemActions {
  /** Drink Creator and Admin: Edit. */
  onEdit?: () => void;
  editLabel?: string;
  /** To make, favourites or your bar, for people who keep it. */
  save?: { saved: boolean; onToggle: () => void; label: [string, string]; icon?: 'bookmark' | 'heart' } | null;
  onShare?: () => void;
  /** Something people posted: Report, for people who can't edit it (App Store 1.2). */
  report?: { itemId: string } | null;
  /** A catalog admin on someone else's drink: Fix as admin opens the editor. */
  adminFix?: () => void;
}

/**
 * The page's one button on the right, …, and its sheet: Edit, Save, Share,
 * Report and Fix as admin, whichever the viewer has, for every role, on every
 * page with the shared header (drink, beer, wine, bottle, house-made). View as
 * lives in Settings (no role switcher on pages, 29 Oct). Nothing when there's
 * nothing to put in it. `k`: what it shows, as plain words, so iOS's bar
 * (ItemHeader) knows when to draw it again.
 */
export function ItemMoreMenu({ name, onEdit, editLabel = 'Edit', save, onShare, report, adminFix, scheme }: ItemActions & { name: string; scheme?: 'light' | 'dark'; k?: string }) {
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  // What to open once the menu has gone: two sheets never stack. A ref, since the sheet's close was made before the tap.
  const then = useRef<(() => void) | null>(null);
  const [reporting, setReporting] = useState(false);
  const canReport = !!report && signedIn && !onEdit;
  const glyph = save?.icon === 'heart' ? 'heart' : 'bookmark';
  const rows: { key: string; icon: IconName; label: string; onPick: () => void }[] = [
    ...(onEdit ? [{ key: 'edit', icon: 'pencil' as IconName, label: editLabel, onPick: onEdit }] : []),
    ...(save ? [{ key: 'save', icon: (save.saved ? `${glyph}.fill` : glyph) as IconName, label: save.label[save.saved ? 1 : 0], onPick: save.onToggle }] : []),
    ...(onShare ? [{ key: 'share', icon: 'square.and.arrow.up' as IconName, label: 'Share', onPick: onShare }] : []),
    ...(canReport ? [{ key: 'report', icon: 'flag' as IconName, label: `Report ${name}`, onPick: () => setReporting(true) }] : []),
    ...(adminFix ? [{ key: 'fix', icon: 'lock.shield.fill' as IconName, label: 'Fix as admin', onPick: adminFix }] : []),
  ];
  if (!rows.length) return null;
  const run = () => {
    const next = then.current;
    then.current = null;
    next?.();
  };

  return (
    <>
      <BarButton accessibilityLabel={`More: ${rows.map((r) => r.label.toLowerCase()).join(', ')}`} icon="ellipsis" scheme={scheme} onPress={() => setOpen(true)} />
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
          {rows.map((r) => (
            <Row key={r.key} icon={r.icon} label={r.label} onPick={() => (then.current = r.onPick)} />
          ))}
        </ScrollView>
      </Sheet>
      {reporting && report ? <ReportSheet subject={name} targets={[{ label: name, target: { kind: 'item', itemId: report.itemId } }]} onClose={() => setReporting(false)} /> : null}
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
