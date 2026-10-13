import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

import { backbar, fontFamilies } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';

// The canvas's muted, warm discs (ppl-you, ppl-person). Light ink initials read on all of them (7:1 or better).
const AVATAR_COLORS = ['#3B342C', '#5B4A6B', '#3E5A4A', '#4A3E66', '#5A4632', '#7A4A22'];

/** First and last initials from a name ("Jo Marsh" JM, "Kevin" K), else the email's first letter. */
export function initialsFor(name?: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  return (email?.trim()[0] ?? '?').toUpperCase();
}

/** A stable colour per person, so the same user always gets the same avatar. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * A person's photo, or their initials on a muted colour when they haven't
 * added one. `neutral` is the warm grey your own avatar takes (ppl-you).
 */
export function UserAvatar({
  uri,
  name,
  email,
  size,
  borderColor,
  borderWidth = 0,
  neutral,
}: {
  uri?: string | null;
  name?: string | null;
  email?: string | null;
  size: number;
  borderColor?: ColorValue;
  borderWidth?: number;
  neutral?: boolean;
}) {
  const frame = { width: size, height: size, borderRadius: size / 2, borderWidth, borderColor };
  if (uri) {
    return <Image source={{ uri }} style={frame} cachePolicy="memory-disk" recyclingKey={uri} accessibilityIgnoresInvertColors />;
  }
  const seed = email || name || '?';
  return (
    <View style={[styles.initials, frame, { backgroundColor: neutral ? AVATAR_COLORS[0] : colorFor(seed) }]}>
      <Text style={[styles.initialsText, { fontSize: Math.round(size * 0.32) }]} allowFontScaling={false}>
        {initialsFor(name, email)}
      </Text>
    </View>
  );
}

/** The display name for the signed-in user, from their profile. */
export function useUserDisplayName(): string {
  const { user } = useAuth();
  const meta = user?.user_metadata;
  return meta?.full_name || [meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || '';
}

/** The signed-in user's avatar, on the neutral warm grey when there's no photo. */
export function CurrentUserAvatar(props: { size: number; borderColor?: ColorValue; borderWidth?: number }) {
  const { user } = useAuth();
  const name = useUserDisplayName();
  return <UserAvatar uri={user?.user_metadata?.avatar_url} name={name} email={user?.email} neutral {...props} />;
}

const styles = StyleSheet.create({
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: backbar.dark.ink,
    fontFamily: fontFamilies.bodySemiBold,
  },
});
