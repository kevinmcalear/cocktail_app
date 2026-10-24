import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Display, PressableScale, Title, useGutter } from '@/components/ds';
import { CurrentUserAvatar } from '@/components/ui/UserAvatar';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { VenueSwitcher } from './VenueSwitcher';

/**
 * The top of every redesigned tab on a phone: the logo (the venue menu) with
 * the page's title beside it ("Tonight", "Discover") on the left, the page's
 * tools and you on the right. The title takes the row the venue's name used
 * to, so the page starts a row higher (Kevin and Eddie, 13 Oct). New is a tab
 * (24 Oct), and the avatar opens You over the tabs in both modes.
 *
 * Wide web has the logo, New and you in the side nav, so there is no avatar
 * on the page (you live in the sidebar's foot): the title (at display size
 * with `display`) and `actions` share one line, or the row is just the space
 * above the page's own title.
 *
 * `center` (phones) fills the middle of the row, between the logo and you,
 * and the title becomes a heading only screen readers hear (Discover's
 * search pill).
 */
export function ScreenHeader({ title, display, actions, center }: { title?: string; display?: boolean; actions?: ReactNode; center?: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useIsWideWeb();
  if (wide) {
    // insets.top: an iPad's status bar (0 on the web).
    if (!title && !actions) return <View style={[styles.wide, { marginTop: insets.top }]} />;
    return (
      <View style={[styles.row, styles.wideTitled, { paddingHorizontal: gutter, marginTop: insets.top }]}>
        {!title ? <View /> : display ? <Display aria-level={1}>{title}</Display> : <Title aria-level={1}>{title}</Title>}
        <View style={styles.end}>{actions}</View>
      </View>
    );
  }
  return (
    <View style={[styles.row, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
      <View style={styles.start}>
        <VenueSwitcher />
        {title && !center ? (
          <Title aria-level={1} numberOfLines={1} style={styles.title}>
            {title}
          </Title>
        ) : null}
      </View>
      {center ? (
        <View style={styles.center}>
          {title ? (
            <Title aria-level={1} numberOfLines={1} style={styles.readerOnly}>
              {title}
            </Title>
          ) : null}
          {center}
        </View>
      ) : null}
      <View style={styles.end}>
        {actions}
        <PressableScale role="link" accessibilityLabel="You: your profile and settings" onPress={() => router.push('/you')} style={styles.avatar}>
          <CurrentUserAvatar size={32} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  // Wide web: the space above the title, where a phone has the logo row.
  wide: { height: space.xl },
  wideTitled: { minHeight: space.xxl + space.md, paddingTop: space.md },
  start: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  title: { flexShrink: 1 },
  center: { flex: 1, minWidth: 0 },
  // In the reading order, off the screen.
  readerOnly: { position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' },
  end: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
});

/**
 * The header inside a list: ScreenHeader handles its own safe-area padding and
 * gutter, so this cancels the list's horizontal padding around it.
 */
export function ScreenHeaderSpacer(props: { title?: string; actions?: ReactNode }) {
  const gutter = useGutter();
  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScreenHeader {...props} />
    </View>
  );
}
