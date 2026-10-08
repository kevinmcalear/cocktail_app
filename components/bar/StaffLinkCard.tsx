import * as Burnt from 'burnt';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Body, Button, useDs } from '@/components/ds';
import { SettingsSection } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { showMessage } from '@/lib/dialogs';
import { venueStaffUrl } from '@/lib/venueLink';

/**
 * The venue's staff link. Staff open it on their phone, sign in, and add the
 * venue's own app (its name and logo) to their home screen.
 */
export function StaffLinkCard({ slug, venueName }: { slug: string; venueName: string }) {
  const ds = useDs();
  const url = venueStaffUrl(slug);
  const web = Platform.OS === 'web';

  const share = async () => {
    try {
      if (!web) {
        await Share.share({ message: url, url, title: `${venueName} staff app` });
        return;
      }
      await navigator.clipboard.writeText(url);
      Burnt.toast({ title: 'Link copied', preset: 'done', duration: 2 });
    } catch {
      // The browser can refuse clipboard access; show the link to copy by hand.
      showMessage("Couldn't copy the link", url);
    }
  };

  return (
    <SettingsSection
      title="Staff link"
      note={`Send this to your team. They sign in and add ${venueName} to their home screen, with your name and logo.`}
    >
      <View style={styles.row}>
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
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  url: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  fill: { flex: 1 },
});
