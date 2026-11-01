import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Crumbs, usePageFrame, type Crumb } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { Caption, Display, dragDismissesKeyboard, GlassButton, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';

/** Where every Learn page sits on wide web (Kept-learn-desk: "Discover › Learn › Clarify › Milk clarification"). */
export const LEARN_CRUMBS: Crumb[] = [
  { label: 'Discover', href: '/discover' },
  { label: 'Learn', href: '/learn' },
];

interface Props {
  eyebrow?: string;
  title: string;
  /** Said under the title. */
  intro?: ReactNode;
  /** Over the title: the technique's or the tool's drawing. */
  art?: ReactNode;
  /** Round buttons at the top right (Kept-learn: Search on Learn). */
  actions?: ReactNode;
  /** Wide web: the pages above this one, where a phone has Back. */
  crumbs?: Crumb[];
  /** Wide web: a column beside the page (Kept-learn-desk: the tool beside the technique). */
  aside?: ReactNode;
  children: ReactNode;
  /** Floating over the foot of the page (the library's My kit pill). */
  footer?: ReactNode;
  /** On a tab's stack (Learn): room for the tab bar under the page. */
  inTabs?: boolean;
}

/** The eyebrow in small capitals, the name in the display face, a line under it (the Kept-learn boards' head). */
export function LearnHead({ eyebrow, title, intro, art }: Pick<Props, 'eyebrow' | 'title' | 'intro' | 'art'>) {
  return (
    <View style={styles.headWrap}>
      {art}
      <View style={styles.header}>
        {eyebrow ? (
          <Caption tone="muted" style={styles.eyebrow}>
            {eyebrow}
          </Caption>
        ) : null}
        <Display aria-level={1}>{title}</Display>
        {intro}
      </View>
    </View>
  );
}

/**
 * The frame every Learn, technique and equipment screen shares: Back (the
 * trail of pages on wide web), the head, a readable column, and on wide web
 * an `aside` column beside it that scrolls on its own. Follows the app's
 * light or dark (Kept-learn draws both).
 */
export function TechniquePage({ eyebrow, title, intro, art, actions, crumbs, aside, children, footer, inTabs }: Props) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  // Left beside the side nav on wide web, like every page (i04, 24 Oct 2026).
  const { wide, column } = usePageFrame();
  const tabBar = useTabBarInset();
  const bottom = (inTabs ? tabBar : insets.bottom) + space.xxxl;
  const top = insets.top + (wide ? space.xxl : layout.minTapTarget + space.lg);
  const side = wide && aside;
  const page = (
    <ScrollView
      {...dragDismissesKeyboard}
      style={side ? styles.main : null}
      contentContainerStyle={[styles.page, side ? null : column, { paddingTop: top, paddingBottom: bottom + (footer ? layout.minTapTarget + space.xl : 0), paddingHorizontal: gutter }]}
    >
      {wide && crumbs?.length ? <Crumbs trail={crumbs} /> : null}
      <LearnHead eyebrow={eyebrow} title={title} intro={intro} art={art} />
      {children}
    </ScrollView>
  );
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {side ? (
        <View style={styles.columns}>
          {page}
          <ScrollView style={styles.aside} contentContainerStyle={[styles.page, { paddingTop: top, paddingBottom: space.xxxl }]}>
            {aside}
          </ScrollView>
        </View>
      ) : (
        page
      )}
      {footer ? (
        <View pointerEvents="box-none" style={[styles.footer, { bottom: insets.bottom + space.md, paddingHorizontal: gutter }]}>
          {footer}
        </View>
      ) : null}
      {wide ? null : (
        <View pointerEvents="box-none" style={[styles.bar, { top: insets.top + space.sm, paddingHorizontal: gutter }]}>
          <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/learn' as Href))} />
          <View style={styles.actions}>{actions}</View>
        </View>
      )}
      {wide && actions ? <View style={[styles.deskActions, { top: insets.top + space.lg, right: gutter }]}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  headWrap: { gap: space.lg },
  header: { gap: space.sm },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
  // Kept-learn-desk: the technique 640 wide, the tool 360 beside it, 56 apart.
  columns: { flex: 1, flexDirection: 'row', gap: space.xxl },
  main: { flexGrow: 0, flexShrink: 1, width: 640 },
  aside: { flexGrow: 0, flexShrink: 0, width: 360 },
  bar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: space.sm },
  deskActions: { position: 'absolute', flexDirection: 'row', gap: space.sm },
  footer: { position: 'absolute', left: 0, right: 0 },
});
