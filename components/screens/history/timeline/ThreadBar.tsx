import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Spec, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { TreeNode } from '@/lib/drinkTree';
import { yearLabel } from '@/lib/lineage';
import { eraBands, eraX, shortYear, threadBack } from '@/lib/timeline';

const who = (n: TreeNode) => [n.creator, n.bar].filter(Boolean).join(' · ');

/**
 * A drink's thread back to the punch bowl: a vertical list of year and name,
 * each step jumping the timeline to it, and how far back its nearest classic
 * sits. On a phone it's a card at the top with a close; in the desktop
 * inspector it's "Its thread" with the era strip, always shown.
 */
export function ThreadCard({ line, focusKey, onStep, onClose, inspector = false }: { line: TreeNode[]; focusKey: string | null; onStep: (key: string) => void; onClose?: () => void; inspector?: boolean }) {
  const ds = useDs();
  const last = line.at(-1)!;
  const current = line.some((n) => n.key === focusKey) ? focusKey : last.key;
  const back = threadBack(line);
  return (
    <View role="region" aria-label={`${last.name}'s thread`} style={[styles.card, !inspector && { backgroundColor: ds.c.raised, padding: space.md }]}>
      <View style={styles.head}>
        {inspector ? (
          <Caption tone="muted" role="heading" style={styles.flex}>
            ITS THREAD
          </Caption>
        ) : (
          <Headline role="heading" style={styles.flex}>{`${last.name}'s thread`}</Headline>
        )}
        {onClose ? (
          <PressableScale role="button" accessibilityLabel="Stop following the thread" onPress={onClose} style={styles.close}>
            <IconSymbol name="xmark" size={16} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>
      {inspector ? <EraStrip line={line} /> : null}
      <View role="list">
        {line.map((n) => {
          const on = n.key === current;
          return (
            <PressableScale
              key={n.key}
              role="link"
              aria-current={on || undefined}
              accessibilityLabel={`${yearLabel(n.year, n.approx) || 'No year'}, ${n.name}${who(n) ? `, ${who(n)}` : ''}`}
              onPress={() => onStep(n.key)}
              style={styles.step}
            >
              <View style={[styles.dot, { backgroundColor: on ? ds.accentText : ds.c.lineStrong }]} />
              <Spec tone="muted" style={styles.year}>
                {shortYear(n)}
              </Spec>
              <View style={styles.flex}>
                <Body style={on ? styles.strong : null} numberOfLines={1}>
                  {n.name}
                </Body>
                {inspector && who(n) ? (
                  <Caption tone="muted" numberOfLines={1}>
                    {who(n)}
                  </Caption>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
      {back ? <Caption tone="muted">{back}</Caption> : null}
    </View>
  );
}

/** The eras as a thin strip with a mark at each step of the thread. */
function EraStrip({ line }: { line: TreeNode[] }) {
  const ds = useDs();
  const said = line.map((n) => `${n.name} ${shortYear(n)}`.trim()).join(', ');
  return (
    <View role="img" accessibilityLabel={`${said}, on the era strip`} style={[styles.strip, { backgroundColor: ds.c.raised }]}>
      {eraBands().map((b, i) => (i ? <View key={b.era.key} style={[styles.band, { left: `${b.x * 100}%`, backgroundColor: ds.c.line }]} /> : null))}
      {line.map((n) =>
        n.year == null ? null : <View key={n.key} style={[styles.mark, { left: `${eraX(n.year) * 100}%`, backgroundColor: ds.accentText }]} />,
      )}
    </View>
  );
}

/** A phone's pick while following a thread: the drink, what changed, and Open. */
export function ThreadPick({ node, bottom }: { node: TreeNode; bottom: number }) {
  const ds = useDs();
  const router = useRouter();
  const where = [yearLabel(node.year, node.approx), [node.bar, node.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  return (
    <View style={[styles.pick, { bottom, backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{node.name}</Headline>
        {where ? <Caption tone="muted">{where}</Caption> : null}
        {node.note ? (
          <Caption numberOfLines={2} style={styles.note}>
            {node.note}
          </Caption>
        ) : null}
      </View>
      {node.kind === 'drink' ? <Button label="Open" accessibilityLabel={`Open ${node.name}`} onPress={() => router.push(`/cocktail/${node.id}` as Href)} /> : null}
    </View>
  );
}

const RIFFS_SHOWN = 3;

/** "Riffs on it": the drinks that came from it, oldest first, three then the rest on tap. */
export function Riffs({ kids, onStep }: { kids: TreeNode[]; onStep: (key: string) => void }) {
  const ds = useDs();
  const [all, setAll] = useState(false);
  if (!kids.length) return null;
  const shown = all ? kids : kids.slice(0, RIFFS_SHOWN);
  const more = kids.length - shown.length;
  return (
    <View style={styles.card}>
      <Caption tone="muted" role="heading">
        RIFFS ON IT
      </Caption>
      <View role="list">
        {shown.map((k) => (
          <PressableScale key={k.key} role="link" accessibilityLabel={`${k.name}${k.creator ? `, ${k.creator}` : ''}, ${yearLabel(k.year, k.approx) || 'no year'}`} onPress={() => onStep(k.key)} style={[styles.riff, { borderBottomColor: ds.c.line }]}>
            <Body style={styles.flex} numberOfLines={1}>
              {k.name}
              {k.creator ? <Body tone="muted">{` · ${k.creator}`}</Body> : null}
            </Body>
            <Spec tone="muted">{shortYear(k)}</Spec>
          </PressableScale>
        ))}
      </View>
      {more ? <Button label={`${more} more ${more === 1 ? 'riff' : 'riffs'}`} variant="secondary" onPress={() => setAll(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: space.sm, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center' },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget - space.xs },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  year: { width: 52 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  strip: { height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  mark: { position: 'absolute', top: 3, width: 8, height: 8, marginLeft: -4, borderRadius: radius.pill },
  pick: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  note: { paddingTop: 2 },
  riff: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, borderBottomWidth: StyleSheet.hairlineWidth },
});
