import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, RowScore, Spec, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useItemScores } from '@/hooks/useFlavor';
import type { TreeNode } from '@/lib/drinkTree';
import { yearLabel } from '@/lib/lineage';
import { eraBands, eraX, shortYear, threadBack } from '@/lib/timeline';

const who = (n: TreeNode) => [n.creator, n.bar].filter(Boolean).join(' · ');

/**
 * A drink's thread back to the punch bowl, each step jumping the timeline to
 * it, and how far back its nearest classic sits. On a phone it's a card at
 * the top: the steps as year chips, the current one filled, and a close
 * (board prep-hist-timeline-thread). In the desktop inspector it's "Its
 * thread": the era strip, then the steps down a line with who made each.
 */
export function ThreadCard({ line, focusKey, onStep, onClose, inspector = false }: { line: TreeNode[]; focusKey: string | null; onStep: (key: string) => void; onClose?: () => void; inspector?: boolean }) {
  const ds = useDs();
  const last = line.at(-1)!;
  const current = line.some((n) => n.key === focusKey) ? focusKey : last.key;
  const back = threadBack(line);
  const label = (n: TreeNode) => `${yearLabel(n.year, n.approx, n.guess) || 'No year'}, ${n.name}${who(n) ? `, ${who(n)}` : ''}`;
  if (inspector) {
    return (
      <View role="region" aria-label={`${last.name}'s thread`} style={styles.card}>
        <Caption tone="muted" role="heading" style={styles.eyebrow}>
          ITS THREAD
        </Caption>
        <EraStrip line={line} />
        <View role="list">
          {line.map((n, i) => {
            const on = n.key === current;
            return (
              <PressableScale key={n.key} role="link" aria-current={on || undefined} accessibilityLabel={label(n)} onPress={() => onStep(n.key)} style={styles.stepDown}>
                <View style={styles.rail}>
                  {i ? <View style={[styles.railLine, styles.railTop, { backgroundColor: ds.c.lineStrong }]} /> : null}
                  {i < line.length - 1 ? <View style={[styles.railLine, styles.railBottom, { backgroundColor: ds.c.lineStrong }]} /> : null}
                  <View style={[styles.ring, on ? { backgroundColor: ds.accentText, borderColor: ds.accentText } : { backgroundColor: ds.c.surface, borderColor: ds.c.muted }]} />
                </View>
                <View style={[styles.flex, styles.stepText]}>
                  <DsText variant="headline" style={styles.serif} numberOfLines={1}>
                    {n.name}
                  </DsText>
                  <Caption tone="muted" numberOfLines={2}>
                    {on ? 'Selected' : [n.kind === 'style' ? 'Style' : who(n), yearLabel(n.year, n.approx, n.guess)].filter(Boolean).join(n.kind === 'style' ? ' · ' : ', ')}
                  </Caption>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <View role="region" aria-label={`${last.name}'s thread`} style={[styles.card, styles.phoneCard, { backgroundColor: ds.c.raised }]}>
      <View style={styles.head}>
        <Caption tone="muted" role="heading" style={[styles.eyebrow, styles.flex]}>
          {`${last.name.toUpperCase()}'S THREAD`}
        </Caption>
        {onClose ? (
          <PressableScale role="button" accessibilityLabel="Stop following the thread" onPress={onClose} style={styles.close}>
            <IconSymbol name="xmark" size={16} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>
      <View role="list" style={styles.steps}>
        {line.map((n) => {
          const on = n.key === current;
          return (
            <PressableScale
              key={n.key}
              role="link"
              aria-current={on || undefined}
              accessibilityLabel={label(n)}
              onPress={() => onStep(n.key)}
              style={[styles.step, on ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong }]}
            >
              <Caption color={on ? ds.accentFill.text : ds.c.ink} numberOfLines={1} style={styles.strong}>
                <Caption color={on ? ds.accentFill.text : ds.c.ink} style={styles.mono}>{shortYear(n) ? `${shortYear(n)} ` : ''}</Caption>
                {n.name}
              </Caption>
            </PressableScale>
          );
        })}
      </View>
      {back ? <Caption tone="accent">{back}</Caption> : null}
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

/** A phone's pick while following a thread: the drink large, its score, what changed, and Open it (board prep-hist-timeline-thread). */
export function ThreadPick({ node, bottom }: { node: TreeNode; bottom: number }) {
  const ds = useDs();
  const router = useRouter();
  const score = useItemScores(node.kind === 'drink' ? [node.id] : []).data?.[node.id];
  const where = [yearLabel(node.year, node.approx, node.guess), [node.bar, node.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  return (
    <View style={[styles.pick, { bottom, backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.pickHead}>
        <View style={styles.flex}>
          <Title numberOfLines={1}>{node.name}</Title>
          {where ? <Caption tone="muted">{where}</Caption> : null}
        </View>
        <RowScore score={score} />
      </View>
      {node.note ? <Body numberOfLines={2}>{node.note}</Body> : null}
      {node.kind === 'drink' ? <Button label={`Open ${node.name}`} size="lg" onPress={() => router.push(`/cocktail/${node.id}` as Href)} /> : null}
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
      <Caption tone="muted" role="heading" style={styles.eyebrow}>
        RIFFS ON IT
      </Caption>
      <View role="list">
        {shown.map((k) => (
          <PressableScale key={k.key} role="link" accessibilityLabel={`${k.name}${k.creator ? `, ${k.creator}` : ''}, ${yearLabel(k.year, k.approx, k.guess) || 'no year'}`} onPress={() => onStep(k.key)} style={[styles.riff, { borderBottomColor: ds.c.line }]}>
            <Body style={styles.flex} numberOfLines={1}>
              {k.name}
              {k.creator ? <Body tone="muted">{` · ${k.creator}`}</Body> : null}
            </Body>
            <Spec tone="muted">{shortYear(k)}</Spec>
          </PressableScale>
        ))}
      </View>
      {more ? (
        <PressableScale role="button" accessibilityLabel={`${more} more ${more === 1 ? 'riff' : 'riffs'}`} onPress={() => setAll(true)} style={styles.more}>
          <Caption tone="accent">{`${more} more ${more === 1 ? 'riff' : 'riffs'}`}</Caption>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: space.sm, borderRadius: radius.card, borderCurve: 'continuous' },
  phoneCard: { padding: space.md + 2 },
  head: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm, marginVertical: -space.sm },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  step: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  mono: { fontFamily: fontFamilies.monoMedium },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  stepDown: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm + 2, minHeight: layout.minTapTarget },
  rail: { width: 12, alignItems: 'center' },
  railLine: { position: 'absolute', width: StyleSheet.hairlineWidth * 2, left: 6 - StyleSheet.hairlineWidth },
  railTop: { top: 0, height: space.sm + 6 },
  railBottom: { top: space.sm + 6, bottom: 0 },
  ring: { width: 11, height: 11, marginTop: space.sm, borderRadius: radius.pill, borderWidth: 1.5 },
  stepText: { paddingBottom: space.sm },
  serif: { fontFamily: fontFamilies.instrument },
  strip: { height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  mark: { position: 'absolute', top: 3, width: 8, height: 8, marginLeft: -4, borderRadius: radius.pill },
  // A card floating at the foot of the list, not a docked sheet: on the web every sheet is a dialog.
  pick: { position: 'absolute', left: space.sm, right: space.sm, gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  pickHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  riff: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, borderBottomWidth: StyleSheet.hairlineWidth },
  more: { alignSelf: 'flex-start', minHeight: layout.minTapTarget - space.sm, justifyContent: 'center' },
});
