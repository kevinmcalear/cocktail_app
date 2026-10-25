import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, useDs } from '@/components/ds';
import { fontFamilies, printPaper, radius, space } from '@/constants/tokens';
import { claimPath } from '@/lib/claimLink';
import { siteOrigin } from '@/lib/venueLink';

import { DrinkCode } from '../menus/DrinkCode';
import { useShareLink } from './useShareLink';

/**
 * "Not your computer?" beside the claim on a wide screen, or under it on a
 * phone that isn't theirs (find-yourself step 4): a QR code and a link that
 * open this claim on their own phone, after they sign in with their own email.
 */
/** ref: the page's handle, or its id when it has none. */
export function ClaimOnYourPhone({ profileRef, name, title }: { profileRef: string; name: string; title?: string }) {
  const ds = useDs();
  const url = `${siteOrigin()}${claimPath(profileRef)}`;
  const share = useShareLink(url, `Claim ${name}`);
  return (
    <View style={styles.panel}>
      {title ? (
        <Body role="heading" style={styles.strong}>
          {title}
        </Body>
      ) : null}
      <Body tone="muted">Scan with your phone. It opens this claim there, after you sign in with your own email.</Body>
      {/* Dark on paper in either theme, as the board draws it: a light-on-dark code doesn't scan everywhere. */}
      <View style={[styles.code, { borderColor: ds.c.line }]}>
        <DrinkCode url={url} label={`QR code that opens ${name}’s claim on your phone`} size={126} onPaper />
      </View>
      <Body tone="muted">Or send yourself the link</Body>
      <Button label={Platform.OS === 'web' ? 'Copy link' : 'Share link'} variant="secondary" icon="link" onPress={() => void share()} style={styles.start} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.md },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  code: { alignSelf: 'flex-start', padding: space.md, backgroundColor: printPaper.paper, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  start: { alignSelf: 'flex-start' },
});
