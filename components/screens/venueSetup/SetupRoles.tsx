import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, TextLink, useDs } from '@/components/ds';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { ROLE_PRESETS, roleLine, roleSummary } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';

const ADMIN = 40;

/** One role: its name, what it can do, and the way into Roles and access. */
function RoleRow({ title, you, line, icon = 'chevron.right', first, onPress }: { title: string; you?: boolean; line: string; icon?: 'chevron.right' | 'plus'; first?: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${title}${you ? ', you' : ''}. ${line}`} onPress={onPress} style={[styles.row, !first && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      {icon === 'plus' ? <IconSymbol name="plus" size={16} color={ds.accentText} /> : null}
      <View style={styles.text}>
        <View style={styles.name}>
          <Body style={styles.bold}>{title}</Body>
          {you ? <Caption tone="muted">You</Caption> : null}
        </View>
        <Caption tone="muted">{line}</Caption>
      </View>
      {icon === 'chevron.right' ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
    </PressableScale>
  );
}

/**
 * Who sees what's second half (board w2-venue-setup, E29, call A): what each
 * role can do inside the venue, before anyone is invited or any drink is
 * written. Built-in roles are ready, so Continue is one tap; every row opens
 * the approved Roles and access table for anything more.
 */
export function SetupRoles({ barId, name }: { barId: string; name: string }) {
  const ds = useDs();
  const router = useRouter();
  const matrix = useRoleMatrix(barId);
  const columns = matrix.data ?? [];
  const builtIn = columns.filter((c) => c.role_id === null && c.base_level >= 20).sort((a, b) => a.base_level - b.base_level);
  const own = columns.filter((c) => c.role_id !== null);
  const open = (extra = '') => router.push(`/settings/bar/${barId}/roles${extra}` as Href);

  return (
    <View style={styles.wrap}>
      <SectionHeading>{`Inside ${name} · what each role can do`}</SectionHeading>
      {matrix.isLoading ? <Caption tone="muted">Loading the roles…</Caption> : null}
      {matrix.error ? <Body tone="muted">Couldn’t load the roles. They’re in Venue settings › Roles and access.</Body> : null}
      {columns.length ? (
        <View role="list" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
          {builtIn.map((c, i) => (
            <RoleRow key={c.base_level} first={i === 0} title={roleLabel(c.base_level)} you={c.base_level === ADMIN} line={roleLine(columns, c.base_level)} onPress={() => open()} />
          ))}
          {own.map((c) => (
            <RoleRow key={c.role_id} title={c.name ?? 'Your role'} line={`${roleSummary(c)}.`} onPress={() => open()} />
          ))}
          <RoleRow icon="plus" title="Add a role" line={ROLE_PRESETS.map((p) => p.name).join(', ')} onPress={() => open('?new=1')} />
        </View>
      ) : null}
      <TextLink label="Change what a role can do" onPress={() => open()} />
      <Caption tone="muted">Invites pick one of these. Change any of it later in Venue settings › Roles and access.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: layout.minTapTarget },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  bold: { fontFamily: fontFamilies.bodySemiBold },
});
