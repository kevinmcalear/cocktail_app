import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Linking, StyleSheet, View } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { normalizeInstagram, profileLinks, type LinkNetwork } from '@/lib/profiles';

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

/** "https://www.corvidglass.com/shop" → "corvidglass.com". */
const siteName = (href: string) => href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, '');

/** A row under a profile's name: Instagram with its handle, the other networks' icons, then the website's address. */
export function ProfileLinks({ profile, align = 'center' }: { profile: Parameters<typeof profileLinks>[0] & { display_name: string }; align?: 'center' | 'start' }) {
  const ds = useDs();
  const links = profileLinks(profile);
  if (!links.length) return null;
  return (
    <View style={[styles.row, align === 'start' && styles.start]}>
      {links.map(({ href, network }) => {
        const { glyph, name } = ICON[network];
        // Instagram says the handle beside its glyph ("@juniper.jo", ppl-person).
        const handle = network === 'instagram' && profile.instagram ? `@${normalizeInstagram(profile.instagram)}` : null;
        if (handle) {
          return (
            <PressableScale key={href} role="link" aria-label={`${profile.display_name} on Instagram, ${handle}`} style={styles.labelled} onPress={() => Linking.openURL(href)}>
              <FontAwesome6 name={glyph} size={16} color={ds.c.ink} />
              <Caption>{handle}</Caption>
            </PressableScale>
          );
        }
        // The website reads as its address, an accent link (ppl-maker), never a lone globe.
        if (network === 'website') {
          return (
            <PressableScale key={href} role="link" aria-label={`${profile.display_name}'s website, ${siteName(href)}`} style={styles.labelled} onPress={() => Linking.openURL(href)}>
              <Caption color={ds.accentText}>{siteName(href)}</Caption>
            </PressableScale>
          );
        }
        return (
          <PressableScale
            key={href}
            role="link"
            aria-label={`${profile.display_name} on ${name}`}
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
  start: { justifyContent: 'flex-start' },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  labelled: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
});
