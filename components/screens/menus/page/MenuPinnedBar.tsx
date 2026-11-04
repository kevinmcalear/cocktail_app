import { StyleSheet } from 'react-native';

import { DsText, useDs } from '@/components/ds';
import { displayFaces, space } from '@/constants/tokens';

import { MenuTopBar, type MenuBarTools } from './MenuTopBar';

interface Props extends MenuBarTools {
  name: string;
  onBack: (() => void) | null;
  onMedia?: boolean;
  /** Scrolled past the top (the collapsed header): the bar gets the page's ground and the menu's name beside Back. */
  collapsed?: { title: string } | null;
  top: number;
  /** The page's side margin, so the backing runs to the screen's edges. */
  gutter?: number;
}

/** A phone's menu page bar, pinned over its scroll. Apart from MenuTopBar, which the guest's page loads too. */
export function MenuPinnedBar({ collapsed, gutter = 0, ...bar }: Props) {
  const ds = useDs();
  return (
    <MenuTopBar {...bar} wrap={[{ paddingHorizontal: gutter }, collapsed ? [styles.backed, { backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }] : null]}>
      {collapsed ? (
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {collapsed.title}
        </DsText>
      ) : null}
    </MenuTopBar>
  );
}

const styles = StyleSheet.create({
  backed: { paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
