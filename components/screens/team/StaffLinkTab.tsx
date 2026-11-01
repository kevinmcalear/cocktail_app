import * as Burnt from 'burnt';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, TextLink, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { Choice } from '@/components/screens/menus/MenuSheet';
import { DrinkCode } from '@/components/screens/menus/DrinkCode';
import { RowDivider, SettingsRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useSaveStaffLink, useStaffLink } from '@/hooks/useStaffLink';
import { showMessage } from '@/lib/dialogs';
import { roleLabel } from '@/lib/roles';
import { shareLink } from '@/lib/shareLink';
import { INVITE_ROLES, TEAM_MANAGE } from '@/lib/team';
import { venueStaffUrl } from '@/lib/venueLink';

const QR = 208;

/**
 * Invite's Staff link tab (Kept-team): the QR code, the link to copy, the role
 * new people join as, whether you approve each one, and Share. Only an Admin
 * changes them here, so for anyone else they read as plain rows. With the link off it says so, and an Admin can turn it back on.
 */
export function StaffLinkTab({ barId, barName, ceiling, admin }: { barId: string; barName: string; ceiling: number; admin: boolean }) {
  const ds = useDs();
  const { active } = useActiveVenue();
  const link = useStaffLink(barId);
  const save = useSaveStaffLink(barId);
  const [picking, setPicking] = useState(false);
  const data = link.data;

  if (link.isLoading) return <Caption tone="muted">Loading…</Caption>;
  if (link.error || !data) return <Body tone="muted" role="alert">Couldn’t load the staff link. Check your connection and try again.</Body>;

  const url = venueStaffUrl(data.slug);
  const copy = async () => {
    try {
      if ((await shareLink(url, `${barName} staff app`, { copy: true })) === 'copied') Burnt.toast({ title: 'Link copied', preset: 'done', duration: 2 });
    } catch {
      showMessage('Couldn’t copy the link', url);
    }
  };
  const roles = INVITE_ROLES.filter((r) => r.level < TEAM_MANAGE && r.level <= ceiling);
  const problem = save.error ? <Caption color={STATUS.danger} role="alert">{save.error.message}</Caption> : null;

  if (!data.on) {
    return (
      <View style={styles.tab}>
        <Body tone="muted">{`The staff link is off, so nobody new can use it. People already on ${barName}’s team aren’t affected.`}</Body>
        {admin ? (
          <SettingsSection>
            <SwitchRow label="Staff link" value={false} onValueChange={(on) => save.mutate({ on })} />
          </SettingsSection>
        ) : null}
        {problem}
      </View>
    );
  }

  return (
    <View style={styles.tab}>
      <View style={styles.code}>
        <DrinkCode url={url} label={`QR code for ${barName}’s staff link`} size={QR} onPaper mark={<VenueMark venue={active?.id === barId ? active : null} size={QR * 0.2} />} />
      </View>
      <SettingsSection>
        <View style={styles.link}>
          <IconSymbol name="link" size={18} color={ds.c.muted} />
          <Body numberOfLines={1} selectable style={styles.url}>{url.replace(/^https?:\/\//, '')}</Body>
          <TextLink label="Copy" accessibilityHint="Copies the staff link" onPress={() => void copy()} />
        </View>
        <RowDivider />
        <SettingsRow label="New people join as" value={roleLabel(data.role)} disabled={!admin} expanded={admin ? picking : undefined} trailing={admin ? undefined : <View />} onPress={() => setPicking((on) => !on)} />
        <RowDivider />
        <SwitchRow label="You approve each one" value={data.approve} disabled={!admin} onValueChange={(approve) => save.mutate({ approve })} />
      </SettingsSection>
      {picking ? (
        <View role="radiogroup" accessibilityLabel="New people join as" style={styles.roles}>
          {roles.map((r) => (
            <Choice key={r.level} label={roleLabel(r.level)} detail={r.detail} selected={data.role === r.level} onPress={() => { save.mutate({ role: r.level }); setPicking(false); }} />
          ))}
        </View>
      ) : null}
      {problem}
      <Button label="Share the link" icon="square.and.arrow.up" size="lg" variant="ink" onPress={() => void copy()} />
      <Caption tone="muted">Anyone with the link can ask to join. Turn it off in Bar settings.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: space.lg },
  code: { alignSelf: 'center', borderRadius: radius.control, overflow: 'hidden' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  url: { flex: 1, minWidth: 0 },
  roles: { gap: space.sm },
});
