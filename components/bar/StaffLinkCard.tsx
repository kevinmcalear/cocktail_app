import * as Burnt from 'burnt';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { RowDivider, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useSaveStaffLink, useStaffLink } from '@/hooks/useStaffLink';
import { showMessage } from '@/lib/dialogs';
import { shareLink } from '@/lib/shareLink';
import { venueStaffUrl } from '@/lib/venueLink';

/**
 * The venue's staff link. Staff open it on their phone, sign in, and add the
 * venue's own app (its name and logo) to their home screen. Turning it off
 * stops anyone new using it; the team already on it carries on.
 */
export function StaffLinkCard({ barId, slug, venueName, canEdit }: { barId: string; slug: string; venueName: string; canEdit: boolean }) {
  const ds = useDs();
  const link = useStaffLink(barId);
  const save = useSaveStaffLink(barId);
  const on = link.data?.on ?? true;
  const url = venueStaffUrl(slug);
  const web = Platform.OS === 'web';

  const share = async () => {
    try {
      if ((await shareLink(url, `${venueName} staff app`, { copy: true })) === 'copied') Burnt.toast({ title: 'Link copied', preset: 'done', duration: 2 });
    } catch {
      // The browser can refuse clipboard access; show the link to copy by hand.
      showMessage("Couldn't copy the link", url);
    }
  };

  return (
    <SettingsSection
      title="Staff link"
      note={on ? `Send this to your team. They sign in and add ${venueName} to their home screen, with your name and logo.` : 'Off, so nobody new can use it.'}
    >
      <SwitchRow label="Staff link" value={on} disabled={!canEdit || !link.data} onValueChange={(next) => save.mutate({ on: next })} />
      {on ? <RowDivider /> : null}
      {on ? <View style={styles.row}>
        <View style={[styles.url, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="link" size={16} color={ds.c.muted} />
          <Body style={styles.fill} numberOfLines={1} selectable>
            {url}
          </Body>
        </View>
        <Button
          variant="secondary"
          icon={web ? 'doc.on.doc' : 'square.and.arrow.up'}
          label={web ? 'Copy link' : 'Share'}
          onPress={() => void share()}
        />
      </View> : null}
      {link.error ? <Caption tone="muted" role="alert">Couldn’t check whether the link is on. Check your connection and try again.</Caption> : null}
      {save.error ? <Caption color={STATUS.danger} role="alert">{save.error.message}</Caption> : null}
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  url: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  fill: { flex: 1 },
});
