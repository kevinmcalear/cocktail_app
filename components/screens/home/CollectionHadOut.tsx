import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, PressableScale, RowScore, Spec, scoreWords, useBreakpoint, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { dayShort, needLine, type HadOutRow, type HadSort, type HadStatus } from '@/lib/collectionStages';
import { itemHref } from '@/lib/itemRoutes';
import { formatScore } from '@/lib/ranking';

import { SortChoice, StageHead, TableHead, stageStyles } from './CollectionStages';

const SORTS = [
  { value: 'best', label: 'Best first' },
  { value: 'recent', label: 'Recent' },
  { value: 'bar', label: 'By bar' },
] as const;

/** "Ready to make", "Need Cynar", "Made at home · 8.2", "Off the menu · memory kept". Null when the shelf is far from it. */
function statusText(s: HadStatus): string | null {
  switch (s.kind) {
    case 'ready':
      return 'Ready to make';
    case 'one':
    case 'two':
      return needLine(s.need);
    case 'made':
      return s.score === null ? 'Made at home' : `Made at home · ${formatScore(s.score)}`;
    case 'off':
      return 'Off the menu · memory kept';
    case 'locked':
      return 'Names only, spec isn’t public';
    default:
      return null;
  }
}

/** The status line in its colour: the accent when you can make it now, softer otherwise, with a lock when the spec is closed. */
function Status({ status }: { status: HadStatus }) {
  const ds = useDs();
  const text = statusText(status);
  if (!text) return null;
  const color = status.kind === 'ready' ? ds.accentText : ds.c.muted;
  return (
    <View style={styles.status}>
      {status.kind === 'locked' ? <IconSymbol name="lock.fill" size={11} color={color} /> : null}
      <Caption color={color} numberOfLines={1} style={styles.shrink}>
        {text}
      </Caption>
    </View>
  );
}

/**
 * Had out (board home-collection-drinks, step 1): every drink you had at a
 * bar, your score, where and when, and whether you can make it at home.
 * Past drinks (off the bar's public menu) open as memories.
 */
export function HadOut({ rows, sort, onSort, onMemory }: { rows: HadOutRow[]; sort: HadSort; onSort: (s: HadSort) => void; onMemory: (memoryId: string) => void }) {
  const ds = useDs();
  const router = useRouter();
  const desk = useBreakpoint() === 'desktop';
  const [now] = useState(() => Date.now());
  const when = (r: HadOutRow) => (r.day ? dayShort(r.day, now) : null);
  const open = (r: HadOutRow) => (r.memoryId ? onMemory(r.memoryId) : r.itemId ? router.push(itemHref('Cocktail', r.itemId)) : undefined);
  const label = (r: HadOutRow) => [r.name, [r.bar, when(r)].filter(Boolean).join(', '), r.score !== null ? `your ${scoreWords(r.score)}` : null, statusText(r.status)].filter(Boolean).join('. ');

  if (!rows.length) return <Body tone="muted">Score a drink you have at a bar and it lands here, with where you had it.</Body>;
  return (
    <View style={stageStyles.section}>
      <StageHead title="Had out">
        <SortChoice options={SORTS} value={sort} onChange={onSort} label="Sort" />
      </StageHead>
      {desk ? (
        <View role="table" aria-label="Drinks you had out">
          <TableHead cols={[{ label: 'Drink', width: null }, { label: 'Bar', width: 180 }, { label: 'When', width: 96 }, { label: 'At home', width: 220 }, { label: 'Your score', width: 84, end: true }]} />
          {rows.map((r) => (
            <PressableScale key={r.key} role="link" accessibilityLabel={label(r)} onPress={() => open(r)} style={[stageStyles.tableRow, { borderBottomColor: ds.c.line }]}>
              <View style={[stageStyles.grow, styles.drink]}>
                <DrinkImage source={r.imageUrl} itemId={r.itemId} accessibilityLabel={r.name} radius="control" style={styles.thumb} aspectRatio={1} />
                <DsText variant="headline" numberOfLines={1} style={stageStyles.grow}>
                  {r.name}
                </DsText>
              </View>
              <Body numberOfLines={1} style={styles.bar}>
                {r.bar ?? 'A bar'}
              </Body>
              <Body tone="muted" style={styles.when}>
                {when(r) ?? ''}
              </Body>
              <View style={styles.home}>
                <Status status={r.status} />
              </View>
              <Spec style={styles.score}>{r.score !== null ? formatScore(r.score) : ''}</Spec>
            </PressableScale>
          ))}
        </View>
      ) : (
        <View role="list">
          {rows.map((r) => (
            <View role="listitem" key={r.key}>
              <DrinkRow
                compact
                name={r.name}
                itemId={r.itemId}
                imageUrl={r.imageUrl}
                glass={null}
                onPress={() => open(r)}
                caption={[r.bar ?? 'A bar', when(r)].filter(Boolean).join(' · ')}
                below={<Status status={r.status} />}
                trailing={<RowScore score={r.score} />}
                label={label(r)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 48, height: 48 },
  bar: { width: 180 },
  when: { width: 96 },
  home: { width: 220 },
  score: { width: 84, textAlign: 'right' },
});
