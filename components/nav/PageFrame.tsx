import { useRouter, type Href } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassButton, PressableScale, Title } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

/** A page above this one, for the trail on wide web. */
export interface Crumb {
  label: string;
  href: Href;
}

/**
 * Where a page opened from another one (Settings, Brand, Publishing...) sits.
 * On wide web it sits left, next to the side nav, at its width: `text` (760)
 * for lists and forms, `wide` (1240) for pages with a preview beside them, or
 * a number where the canvas draws one (Settings is 680). Never centred there.
 * On a phone it's the full width inside the gutter. `top` is the room above
 * the page: the status bar on a phone, 40 or so on the web.
 */
export function usePageFrame(width: keyof typeof layout.page | number = 'text'): { wide: boolean; column: ViewStyle; top: number } {
  const wide = useIsWideWeb();
  const insets = useSafeAreaInsets();
  const maxWidth = typeof width === 'number' ? width : layout.page[width];
  return {
    wide,
    column: { width: '100%', maxWidth, alignSelf: wide ? 'flex-start' : 'center' },
    top: wide ? space.xxl + space.sm : insets.top + space.sm,
  };
}

/** The pages above this one, as links: "Venue settings", or "Settings / Little Rye". */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  const router = useRouter();
  return (
    <View role="navigation" accessibilityLabel="You are in" style={styles.crumbs}>
      {trail.map((c, i) => (
        <Fragment key={c.label}>
          {i > 0 ? <Caption tone="muted">/</Caption> : null}
          <PressableScale role="link" accessibilityLabel={c.label} onPress={() => router.navigate(c.href)} hitSlop={8}>
            <Caption tone="muted">{c.label}</Caption>
          </PressableScale>
        </Fragment>
      ))}
    </View>
  );
}

/** Back on a phone: a chevron on the web, an X on native, where these pages open as sheets. */
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <GlassButton
      accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
      icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
      onPress={onPress}
    />
  );
}

/**
 * The head of a page opened from another: on a phone a Back button beside
 * the title; on wide web, where the sidebar is the way around, no Back
 * button, and the trail of pages above (`crumbs`) sits over the title.
 * `leading` goes before the title (a venue's logo), `trailing` after it.
 */
export function SubPageHead({ title, subtitle, crumbs, onBack, leading, trailing }: {
  title: string;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  onBack: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const wide = useIsWideWeb();
  return (
    <View style={styles.head}>
      {wide ? null : <BackButton onPress={onBack} />}
      {leading}
      <View style={styles.title}>
        {wide && crumbs?.length ? <Crumbs trail={crumbs} /> : null}
        <Title numberOfLines={wide ? undefined : 1}>{title}</Title>
        {typeof subtitle === 'string' ? (
          <Caption tone="muted" numberOfLines={1}>
            {subtitle}
          </Caption>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  title: { flex: 1, gap: 2, minWidth: 0 },
});
