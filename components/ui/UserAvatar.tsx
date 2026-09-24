import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

import { useAuth } from '@/ctx/AuthContext';

// White initials read on all of these (4.5:1 or better).
const AVATAR_COLORS = ['#5B5BD6', '#0D74CE', '#0D7F71', '#2B7A4B', '#CA244D', '#8E4EC6', '#BD4B00', '#8A6547'];

/** Up to two initials from a name, else the email's first letter. */
export function initialsFor(name?: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email?.trim()[0] ?? '?').toUpperCase();
}

/** A stable colour per person, so the same user always gets the same avatar. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** A person's photo, or their initials on a colour when they haven't added one. */
export function UserAvatar({
  uri,
  name,
  email,
  size,
  borderColor,
  borderWidth = 0,
}: {
  uri?: string | null;
  name?: string | null;
  email?: string | null;
  size: number;
  borderColor?: ColorValue;
  borderWidth?: number;
}) {
  const frame = { width: size, height: size, borderRadius: size / 2, borderWidth, borderColor };
  if (uri) {
    return <Image source={{ uri }} style={frame} accessibilityIgnoresInvertColors />;
  }
  const seed = email || name || '?';
  return (
    <View style={[styles.initials, frame, { backgroundColor: colorFor(seed) }]}>
      <Text style={[styles.initialsText, { fontSize: Math.round(size * 0.4) }]} allowFontScaling={false}>
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

/** The signed-in user's avatar. */
export function CurrentUserAvatar(props: { size: number; borderColor?: ColorValue; borderWidth?: number }) {
  const { user } = useAuth();
  const name = useUserDisplayName();
  return <UserAvatar uri={user?.user_metadata?.avatar_url} name={name} email={user?.email} {...props} />;
}

const styles = StyleSheet.create({
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontFamily: 'InterSemiBold',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
