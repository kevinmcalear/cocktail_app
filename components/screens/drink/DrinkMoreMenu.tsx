import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, GlassButton, PressableScale, Sheet, Title, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useViewAs } from '@/hooks/useViewAs';
import { viewAsChoices } from '@/lib/roleLens';
import { roleLabel } from '@/lib/roles';

import { Choice } from '../menus/MenuSheet';
import { ReportSheet } from '../safety/ReportSheet';

interface DrinkMoreMenuProps {
  itemId: string;
  name: string;
  canEdit: boolean;
  /** A catalog admin on someone else's drink: Fix as admin opens the editor, at every width. */
  adminFix?: boolean;
  onEdit: () => void;
  /** Wide screens show Edit beside the hero, so it stays out of here. */
  wide: boolean;
  /** Share lives here instead of its own button (while viewing as another role). */
  onShare?: () => void;
  /** Your real role at the drink's venue, or null off its team. */
  teamRole: number | null;
  /** Glass ink over the hero (light on sketch paper). */
  scheme?: 'light' | 'dark';
}

/**
 * The More button and its sheet (boards drink-phone-venue/-home/-floor): Edit
 * on phones, View as for staff, Report for everyone else, Fix as admin for a
 * catalog admin on someone else's drink, and Share when it isn't its own button. Nothing when there's nothing to put in it.
 */
export function DrinkMoreMenu({ itemId, name, canEdit, adminFix = false, onEdit, wide, onShare, teamRole, scheme }: DrinkMoreMenuProps) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  // What to open once the menu has gone: two sheets never stack. A ref, since the sheet's close was made before the tap.
  const then = useRef<(() => void) | null>(null);
  const [reporting, setReporting] = useState(false);
  const edit = canEdit && !wide;
  const viewAs = !!teamRole && teamRole > 10;
  const report = signedIn && !canEdit;
  if (!edit && !viewAs && !report && !adminFix && !onShare) return null;
  const parts = [onShare ? 'share' : null, edit ? 'edit' : null, viewAs ? 'view as' : null, report ? 'report' : null, adminFix ? 'fix as admin' : null].filter(Boolean).join(', ');
  const run = () => {
    const next = then.current;
    then.current = null;
    next?.();
  };

  return (
    <>
      <GlassButton accessibilityLabel={`More: ${parts}`} icon="ellipsis" scheme={scheme} onPress={() => setOpen(true)} />
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
          {onShare ? <Row icon="square.and.arrow.up" label="Share" onPick={() => (then.current = onShare)} /> : null}
          {edit ? <Row icon="pencil" label="Edit drink" onPick={() => (then.current = onEdit)} /> : null}
          {viewAs ? <ViewAs realRole={teamRole!} /> : null}
          {viewAs ? (
            <Row icon="info.circle" label="Who sees what" onPick={() => (then.current = () => router.push({ pathname: '/cocktail/[id]/roles', params: { id: itemId } } as unknown as Href))} />
          ) : null}
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
function Row({ icon, label, onPick }: { icon: IconName; label: string; onPick: () => void }) {
  const ds = useDs();
  const close = useSheetClose();
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
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
      <Body style={styles.flex}>{label}</Body>
    </PressableScale>
  );
}

/** See the page as a role below yours, with what each one adds. */
function ViewAs({ realRole }: { realRole: number }) {
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();
  const current = Math.min(viewAsRoleLevel ?? realRole, realRole);
  return (
    <View style={styles.viewAs} role="radiogroup" accessibilityLabel="View as">
      <Caption tone="muted" style={styles.eyebrow}>
        VIEW AS
      </Caption>
      {viewAsChoices(realRole).map((c) => (
        <Choice
          key={c.level}
          label={c.level === realRole ? `${c.label} (you)` : c.label}
          detail={c.adds}
          selected={c.level === current}
          disabled={isSaving}
          onPress={() => void setViewAsRoleLevel(c.level === realRole ? null : c.level)}
        />
      ))}
      {current < realRole ? <Caption tone="muted">{`Every venue page shows what ${/^[AEIOU]/.test(roleLabel(current)) ? 'an' : 'a'} ${roleLabel(current)} sees until you change it back.`}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  flex: { flex: 1 },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  viewAs: { gap: space.sm, paddingTop: space.lg },
  eyebrow: { letterSpacing: 1.2 },
});
