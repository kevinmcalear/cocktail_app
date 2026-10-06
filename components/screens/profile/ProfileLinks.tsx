import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Linking, StyleSheet, View } from 'react-native';

import { PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { profileLinks, type LinkNetwork } from '@/lib/profiles';

/** FontAwesome 6 glyph and spoken name for each network. The brand glyphs come from its Brands font. */
const ICON: Record<LinkNetwork, { glyph: string; name: string }> = {
  instagram: { glyph: 'instagram', name: 'Instagram' },
  tiktok: { glyph: 'tiktok', name: 'TikTok' },
  facebook: { glyph: 'facebook', name: 'Facebook' },
  x: { glyph: 'x-twitter', name: 'X' },
  youtube: { glyph: 'youtube', name: 'YouTube' },
  threads: { glyph: 'threads', name: 'Threads' },
  website: { glyph: 'globe', name: 'website' },
};

/** A row of icons under a profile's name: Instagram, the other networks, then the website. */
export function ProfileLinks({ profile }: { profile: Parameters<typeof profileLinks>[0] & { display_name: string } }) {
  const ds = useDs();
  const links = profileLinks(profile);
  if (!links.length) return null;
  return (
    <View style={styles.row}>
      {links.map(({ href, network }) => {
        const { glyph, name } = ICON[network];
        return (
          <PressableScale
            key={href}
            role="link"
            aria-label={network === 'website' ? `${profile.display_name}'s website` : `${profile.display_name} on ${name}`}
            style={styles.button}
            onPress={() => Linking.openURL(href)}
          >
            <FontAwesome6 name={glyph} size={22} color={ds.c.ink} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
