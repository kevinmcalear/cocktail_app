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
import { useNewStaffLink, useSaveStaffLink, useStaffLink } from '@/hooks/useStaffLink';
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
 * The link carries a secret only Admins read, so only they see the code and
 * the link; New link replaces the secret and the old link stops working.
 */
export function StaffLinkTab({ barId, barName, ceiling, admin }: { barId: string; barName: string; ceiling: number; admin: boolean }) {
  const ds = useDs();
  const { active } = useActiveVenue();
  const link = useStaffLink(barId);
  const save = useSaveStaffLink(barId);
  const renew = useNewStaffLink(barId);
  const [picking, setPicking] = useState(false);
  // Asked here, not in a dialog: on the web a dialog opens behind this sheet.
  const [renewing, setRenewing] = useState(false);
  const data = link.data;

  if (link.isLoading) return <Caption tone="muted">Loading…</Caption>;
  if (link.error || !data) return <Body tone="muted" role="alert">Couldn’t load the staff link. Check your connection and try again.</Body>;

  const url = data.token ? venueStaffUrl(data.slug, data.token) : null;
  const copy = async () => {
    if (!url) return;
    try {
      if ((await shareLink(url, `${barName} staff app`, { copy: true })) === 'copied') Burnt.toast({ title: 'Link copied', preset: 'done', duration: 2 });
    } catch {
      showMessage('Couldn’t copy the link', url);
    }
  };
  const roles = INVITE_ROLES.filter((r) => r.level < TEAM_MANAGE && r.level <= ceiling);
  const failed = save.error ?? renew.error;
  const problem = failed ? <Caption color={STATUS.danger} role="alert">{failed.message}</Caption> : null;
  const newLink = () => renew.mutate(undefined, { onSuccess: () => setRenewing(false) });

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
      {url ? (
        <View style={styles.code}>
          <DrinkCode url={url} label={`QR code for ${barName}’s staff link`} size={QR} onPaper mark={<VenueMark venue={active?.id === barId ? active : null} size={QR * 0.2} />} />
        </View>
      ) : (
        <Body tone="muted">{`An Admin shares ${barName}’s staff link.`}</Body>
      )}
      <SettingsSection>
        {url ? (
          <>
            <View style={styles.link}>
              <IconSymbol name="link" size={18} color={ds.c.muted} />
              <Body numberOfLines={1} selectable style={styles.url}>{url.replace(/^https?:\/\//, '')}</Body>
              <TextLink label="Copy" accessibilityHint="Copies the staff link" onPress={() => void copy()} />
            </View>
            <RowDivider />
          </>
        ) : null}
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
      {url ? <Button label="Share the link" icon="square.and.arrow.up" size="lg" variant="ink" onPress={() => void copy()} /> : null}
      <Caption tone="muted">Anyone with the link can ask to join. Turn it off in Bar settings.</Caption>
      {url && admin && !renewing ? <TextLink label="New link" accessibilityHint="Replaces the link and its code. The old one stops working." onPress={() => setRenewing(true)} /> : null}
      {url && admin && renewing ? (
        <View style={styles.renew}>
          <Body>{`The old link and its code stop working. People already on ${barName}’s team aren’t affected.`}</Body>
          <Button label={renew.isPending ? 'Making a new link…' : 'Make a new link'} variant="danger" disabled={renew.isPending} onPress={newLink} />
          <TextLink label="Keep this link" disabled={renew.isPending} onPress={() => setRenewing(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: space.lg },
  code: { alignSelf: 'center', borderRadius: radius.control, overflow: 'hidden' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  url: { flex: 1, minWidth: 0 },
  roles: { gap: space.sm },
  renew: { gap: space.sm, alignItems: 'flex-start' },
});
