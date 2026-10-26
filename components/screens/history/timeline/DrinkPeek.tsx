import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DrinkImage, PressableScale, RowScore, Sheet, SheetScrollView, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useDrinkSources } from '@/hooks/useDrinkSources';
import { useItemScores } from '@/hooks/useFlavor';
import type { TreeNode } from '@/lib/drinkTree';
import { yearLabel } from '@/lib/lineage';
import { fromLine } from '@/lib/timeline';

export const drinkHref = (id: string) => `/cocktail/${id}` as Href;
const profileHref = (id: string) => `/p/${id}` as Href;

interface PeekProps {
  node: TreeNode;
  from: TreeNode | null;
  /** How many classics in the tree came from it. */
  kids: number;
  /** How many drinks on the timeline its maker made ("5 drinks here"). */
  byMaker: number;
  threadOn: boolean;
  /** Show or hide its thread; left out in the desktop inspector, which always shows it. */
  onThread?: () => void;
  /** Open a page: the peek closes first. Pushes straight away without. */
  onGo?: (href: Href) => void;
}

/**
 * A moment on the timeline, and the ways out of it: the drink's page, the
 * person who made it, the bar it was first poured at, and its thread back to
 * the punch bowl.
 */
export function DrinkDetail({ node, from, kids, byMaker, threadOn, onThread, onGo }: PeekProps) {
  const ds = useDs();
  const router = useRouter();
  const go = onGo ?? ((href: Href) => router.push(href));
  const style = node.kind === 'style';
  const ids = style ? [] : [node.id];
  const city = useDrinkSources(ids).data?.[node.id]?.city;
  const score = useItemScores(ids).data?.[node.id];
  const bar = node.bar ? [`${node.bar}${node.barClosed ? ' (closed)' : ''}`, city].filter(Boolean).join(', ') : null;
  const where = [yearLabel(node.year, node.approx, node.guess), bar].filter(Boolean).join(' · ');
  const lineage = [fromLine({ from }), kids ? `${kids} riff${kids === 1 ? '' : 's'} on it` : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.detail}>
      {/* A drink leads with its drawing and ends with its score (b02); a style is words only. */}
      <View style={styles.headRow}>
        {style ? null : (
          <View style={styles.thumb}>
            <DrinkImage thumb sketchDetail="thumb" itemId={node.id} glass={null} accessibilityLabel={node.name} radius="control" />
          </View>
        )}
        <View style={[styles.head, styles.flex]}>
          {style ? <Caption tone="muted">Historic style</Caption> : null}
          <Title>{node.name}</Title>
          {where ? <Caption tone="muted">{where}</Caption> : null}
        </View>
        <RowScore score={score} />
      </View>
      {node.note ? <Body>{node.note}</Body> : null}
      <View style={styles.threadRow}>
        <Caption tone="muted" style={styles.flex}>
          {lineage || 'The first of its line'}
        </Caption>
        {onThread ? <Button label={threadOn ? 'Hide its thread' : 'Show its thread'} icon="arrow.uturn.backward" variant="secondary" onPress={onThread} /> : null}
      </View>
      {style ? null : <Button label={`Open ${node.name}`} size="lg" onPress={() => go(drinkHref(node.id))} />}
      {node.creatorId || node.barId ? (
        <View style={styles.dests}>
          {node.creatorId && node.creator ? (
            <PressableScale role="link" accessibilityLabel={`${node.creator}'s profile`} onPress={() => go(profileHref(node.creatorId!))} style={[styles.dest, { backgroundColor: ds.c.raised }]}>
              <UserAvatar name={node.creator} size={32} />
              <View style={styles.flex}>
                <Caption numberOfLines={1} style={styles.destName}>
                  {node.creator}
                </Caption>
                <Caption tone="muted">{byMaker > 1 ? `${byMaker} drinks here` : 'Made it'}</Caption>
              </View>
            </PressableScale>
          ) : null}
          {node.barId && node.bar ? (
            <PressableScale role="link" accessibilityLabel={`${node.bar}'s profile`} onPress={() => go(profileHref(node.barId!))} style={[styles.dest, { backgroundColor: ds.c.raised }]}>
              <View style={[styles.barMark, { backgroundColor: ds.c.surface }]}>
                <IconSymbol name="building.2" size={16} color={ds.c.muted} />
              </View>
              <View style={styles.flex}>
                <Caption numberOfLines={1} style={styles.destName}>
                  {node.bar}
                </Caption>
                <Caption tone="muted">{['Bar', node.city, node.barClosed ? 'closed' : null].filter(Boolean).join(' · ')}</Caption>
              </View>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The phone's peek: DrinkDetail in a sheet over the timeline. A page opens
 * once the sheet has gone: pushed under the open Modal on iOS, the Modal
 * stayed up unseen and the timeline took no taps after Back (E47, 26 Oct 2026).
 */
export function PeekSheet({ onClose, ...props }: PeekProps & { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // A ref: iOS calls onDismiss from the Modal, after the render that closed it.
  const then = useRef<Href | null>(null);
  const run = () => {
    const href = then.current;
    if (!href) return;
    then.current = null;
    onClose();
    router.push(href);
  };
  const go = (href: Href) => {
    then.current = href;
    setOpen(false);
    if (Platform.OS !== 'ios') run();
  };
  return (
    <BackbarTheme>
      <Sheet visible={open} onClose={onClose} onDismiss={run} accessibilityLabel={props.node.name} style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <SheetScrollView contentContainerStyle={styles.body}>
          <DrinkDetail {...props} onGo={go} />
        </SheetScrollView>
      </Sheet>
    </BackbarTheme>
  );
}

const styles = StyleSheet.create({
  detail: { gap: space.md },
  head: { gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 72 },
  flex: { flex: 1, minWidth: 0 },
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dests: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dest: { flexGrow: 1, flexBasis: 150, minHeight: layout.minTapTarget + space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  destName: { fontFamily: fontFamilies.bodySemiBold },
  barMark: { width: 32, height: 32, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  sheet: { maxHeight: '75%' },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
});
