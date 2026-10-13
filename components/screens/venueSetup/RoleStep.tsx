import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Spec, useDs } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { SetupHead } from '@/components/screens/onboarding/SetupParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { ROLE_LEVELS } from '@/lib/roles';
import { INVITE_ROLES } from '@/lib/team';

const WHAT_ADMIN_DOES = [
  'Invite your team and choose what each person can do',
  'Set the brand, hours and who sees your page',
  'Add and edit drinks, preps and menus',
  'See everything your staff see, including the staff list',
];

/** The role ladder's lines: the invite sheet's words, and Guest, which nobody is invited as. */
function roleLine(level: number): string {
  if (level === 10) return 'Your public page, as you set it in step 6';
  return INVITE_ROLES.find((r) => r.level === level)?.detail ?? '';
}

/** Step 3: whoever sets the venue up is its Admin, and what that means, beside every role. */
export function RoleStep({ name, pending, onDone }: { name: string; pending: boolean; onDone: () => void }) {
  const ds = useDs();
  return (
    <SetupPage footer={<SetupFooter onPress={onDone} onSkip={onDone} />}>
      <SetupHead>What that means</SetupHead>
      <View role="list">
        {WHAT_ADMIN_DOES.map((line) => (
          <View key={line} role="listitem" style={[styles.item, { borderBottomColor: ds.c.line }]}>
            <IconSymbol name="checkmark" size={16} color={ds.accentText} />
            <Body style={styles.flex}>{line}</Body>
          </View>
        ))}
      </View>
      <SetupHead>{`Roles at ${name}`}</SetupHead>
      <View role="list" style={styles.roles}>
        {[...ROLE_LEVELS].reverse().map((r) => {
          const you = r.level === 40;
          return (
            <View key={r.level} role="listitem" style={[styles.role, { borderColor: you ? ds.accentText : ds.c.line, backgroundColor: you ? ds.c.raised : 'transparent' }]}>
              <View style={styles.flex}>
                <DsText variant="body" style={you ? styles.strong : styles.medium}>
                  {r.label}
                  {you ? <Caption color={ds.accentText} style={styles.strong}>{'  You'}</Caption> : null}
                </DsText>
                <Caption tone="muted">{roleLine(r.level)}</Caption>
              </View>
              <Spec tone="muted">{String(r.level)}</Spec>
            </View>
          );
        })}
      </View>
      {pending ? (
        <View role="status" style={[styles.status, { borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="lock.shield.fill" size={18} color={ds.c.muted} />
          <View style={styles.flex}>
            <Body style={styles.strong}>While your claim is checked</Body>
            <Caption tone="muted">You’re Admin of everything you set up. The people you invite join once the claim is approved, and so does any change to the public page.</Caption>
          </View>
        </View>
      ) : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  // Each role in its own card; yours ringed in the accent (canvas make-venue-role).
  roles: { gap: space.sm },
  role: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md + 2, borderWidth: 1, borderRadius: radius.control },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, marginTop: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  medium: { fontFamily: fontFamilies.bodyMedium },
});
