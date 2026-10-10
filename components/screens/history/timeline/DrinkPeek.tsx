import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, PressableScale, Sheet, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { TreeNode } from '@/lib/drinkTree';
import { yearLabel } from '@/lib/lineage';
import { fromLine } from '@/lib/timeline';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;
const profileHref = (id: string) => `/p/${id}` as Href;

interface PeekProps {
  node: TreeNode;
  from: TreeNode | null;
  /** How many classics in the tree came from it. */
  kids: number;
  threadOn: boolean;
  onThread: () => void;
}

/**
 * A moment on the timeline, and the ways out of it: the drink's page, the
 * person who made it, the bar it was first poured at, and its thread back to
 * the punch bowl.
 */
export function DrinkDetail({ node, from, kids, threadOn, onThread }: PeekProps) {
  const ds = useDs();
  const router = useRouter();
  const style = node.kind === 'style';
  const where = [yearLabel(node.year, node.approx), node.bar ? `${node.bar}${node.barClosed ? ' (closed)' : ''}` : null].filter(Boolean).join(' · ');
  const lineage = [fromLine({ from }), kids ? `${kids} came from it` : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.detail}>
      <View style={styles.head}>
        {style ? <Caption tone="muted">Historic style</Caption> : null}
        <Title>{node.name}</Title>
        {where ? <Caption tone="muted">{where}</Caption> : null}
      </View>
      {node.note ? <Body>{node.note}</Body> : null}
      <View style={styles.threadRow}>
        <Caption tone="muted" style={styles.flex}>
          {lineage || 'The first of its line'}
        </Caption>
        <Button label={threadOn ? 'Hide its thread' : 'Show its thread'} variant="secondary" onPress={onThread} />
      </View>
      {style ? null : <Button label={`Open ${node.name}`} onPress={() => router.push(drinkHref(node.id))} />}
      {node.creatorId || node.barId ? (
        <View style={styles.dests}>
          {node.creatorId && node.creator ? (
            <PressableScale role="link" accessibilityLabel={`${node.creator}'s profile`} onPress={() => router.push(profileHref(node.creatorId!))} style={[styles.dest, { backgroundColor: ds.c.raised }]}>
              <UserAvatar name={node.creator} size={32} />
              <View style={styles.flex}>
                <Caption numberOfLines={1} style={styles.destName}>
                  {node.creator}
                </Caption>
                <Caption tone="muted">Made it</Caption>
              </View>
            </PressableScale>
          ) : null}
          {node.barId && node.bar ? (
            <PressableScale role="link" accessibilityLabel={`${node.bar}'s profile`} onPress={() => router.push(profileHref(node.barId!))} style={[styles.dest, { backgroundColor: ds.c.raised }]}>
              <View style={[styles.barMark, { backgroundColor: ds.c.surface }]}>
                <IconSymbol name="building.2" size={16} color={ds.c.muted} />
              </View>
              <View style={styles.flex}>
                <Caption numberOfLines={1} style={styles.destName}>
                  {node.bar}
                </Caption>
                <Caption tone="muted">{node.barClosed ? 'Bar · closed' : 'Bar'}</Caption>
              </View>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The phone's peek: DrinkDetail in a sheet over the timeline. */
export function PeekSheet({ onClose, ...props }: PeekProps & { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <BackbarTheme>
      <Sheet visible onClose={onClose} accessibilityLabel={props.node.name} style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <ScrollView contentContainerStyle={styles.body}>
          <DrinkDetail {...props} />
        </ScrollView>
      </Sheet>
    </BackbarTheme>
  );
}

const styles = StyleSheet.create({
  detail: { gap: space.md },
  head: { gap: 2 },
  flex: { flex: 1, minWidth: 0 },
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dests: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dest: { flexGrow: 1, flexBasis: 150, minHeight: layout.minTapTarget + space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  destName: { fontFamily: fontFamilies.bodySemiBold },
  barMark: { width: 32, height: 32, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  sheet: { maxHeight: '75%' },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
});
