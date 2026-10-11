import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, Spec, Surface, Tag, useDs } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, space } from '@/constants/tokens';
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
      <Headline role="heading">What that means</Headline>
      <View role="list" style={styles.list}>
        {WHAT_ADMIN_DOES.map((line) => (
          <View key={line} role="listitem" style={styles.item}>
            <IconSymbol name="checkmark" size={16} color={ds.accentText} />
            <Body style={styles.flex}>{line}</Body>
          </View>
        ))}
      </View>
      <Headline role="heading">{`Roles at ${name}`}</Headline>
      <View role="list">
        {[...ROLE_LEVELS].reverse().map((r) => (
          <View key={r.level} role="listitem" style={[styles.role, { borderBottomColor: ds.c.line }]}>
            <View style={styles.flex}>
              <View style={styles.name}>
                <DsText variant="headline">{r.label}</DsText>
                {r.level === 40 ? <Tag label="You" tone="accent" /> : null}
              </View>
              <Caption tone="muted">{roleLine(r.level)}</Caption>
            </View>
            <Spec tone="muted">{String(r.level)}</Spec>
          </View>
        ))}
      </View>
      {pending ? (
        <View role="status">
          <Surface style={styles.status}>
            <IconSymbol name="clock.arrow.circlepath" size={20} color={ds.accentText} />
            <View style={styles.flex}>
              <Body style={styles.strong}>While your claim is checked</Body>
              <Caption tone="muted">You’re Admin of everything you set up. People you invite join once the claim is approved, and the public page changes then too.</Caption>
            </View>
          </Surface>
        </View>
      ) : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  name: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  role: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
