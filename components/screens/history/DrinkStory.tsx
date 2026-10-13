import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, PressableScale, RowScore, Spec, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { useItemScores } from '@/hooks/useFlavor';
import { useHistoryStory } from '@/hooks/useHistoryStory';
import { lineAmount } from '@/lib/drinkMath';
import { FAMILIES, type TreeNode } from '@/lib/drinkTree';
import { specLines, type PresentationRecipe } from '@/lib/spec';
import { shortYear, thread } from '@/lib/timeline';
import { TIER_LABEL, tierOf } from '@/lib/timeTree';

import { byScore } from '../drink/ServedAt';
import { useFamilyHue } from './timeline/TimelineRow';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;
const bookHref = (key: string) => `/book/${key}` as Href;
const TILE = 72;
/** Bar versions shown before "N more versions". */
const VERSIONS = 3;

/** "en.wikipedia.org/wiki/Boulevardier_(cocktail)": a source link as the board prints it. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/** A label and what it says, one fact in the story. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Caption tone="muted" style={styles.label}>
        {label}
      </Caption>
      {children}
    </View>
  );
}

/** Filled chips, each one a way to another drink. */
function Chips({ items }: { items: { key: string; label: string; dot?: string; onPress: () => void }[] }) {
  const ds = useDs();
  return (
    <View style={styles.chips}>
      {items.map((it) => (
        <PressableScale key={it.key} role="link" accessibilityLabel={it.label} onPress={it.onPress} style={[styles.chip, { backgroundColor: ds.c.raised }]}>
          {it.dot ? <View style={[styles.dot, { backgroundColor: it.dot }]} /> : null}
          <Caption numberOfLines={1}>{it.label}</Caption>
        </PressableScale>
      ))}
    </View>
  );
}

/** An accent link in the story: a source, more versions, the timeline. */
function Link({ label, onPress, underline }: { label: string; onPress: () => void; underline?: boolean }) {
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} style={styles.link}>
      <Caption tone="accent" style={underline ? styles.underline : null}>
        {label}
      </Caption>
    </PressableScale>
  );
}

/**
 * A drink's whole story from History's tree (boards prep-hist-tree-phone and
 * -desktop): its family and tier in the family's colour, its drawing, name
 * and aliases, who made it where, Open, the line it descends from, what
 * changed, its spec in ml, the riffs on it, the bars' versions best scored
 * first, and sources. The phone's sheet and the desktop panel both show it.
 * ponytail: no "Also borrows from" (the tree keeps one parent per drink).
 */
export function DrinkStory({ node, nodes, onSelect, onTimeline, onClose }: { node: TreeNode; nodes: readonly TreeNode[]; onSelect: (key: string) => void; onTimeline?: () => void; onClose?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const hue = useFamilyHue(node.family);
  const drink = node.kind === 'drink';
  const { data: story } = useHistoryStory(drink ? node.id : null);
  const { data: item } = useCocktail(drink ? node.id : undefined);
  const { data: scores = {} } = useItemScores((story?.versions ?? []).map((v) => v.id));
  const family = FAMILIES.find((f) => f.key === node.family)?.name ?? (node.family === 'trunk' ? 'The trunk' : null);
  const line = thread(nodes, node.key).slice(0, -1);
  const riffs = nodes.filter((n) => n.parentKey === node.key);
  const spec = specLines((item?.recipes ?? null) as PresentationRecipe[] | null)
    .filter((l) => l.ingredient)
    .map((l) => [lineAmount(l, 'ml'), l.ingredient?.toLowerCase()].filter(Boolean).join(' '))
    .join(', ');
  const meta = [shortYear(node) || null, node.creator, node.city, drink ? (node.bar ? `${node.bar}${node.barClosed ? ' (closed)' : ''}` : 'no bar on record') : null]
    .filter(Boolean)
    .join(' · ');
  const aliases = story?.aliases ?? [];
  const versions = byScore(story?.versions ?? [], scores).slice(0, VERSIONS);
  const more = node.versions - versions.length;

  return (
    <View style={styles.story}>
      <View style={styles.top}>
        <Caption color={hue} style={[styles.label, styles.flex]}>
          {[family, TIER_LABEL[tierOf(node)]].filter(Boolean).join(' · ')}
        </Caption>
        {onClose ? (
          <PressableScale role="button" accessibilityLabel="Close" onPress={onClose} style={[styles.close, { backgroundColor: ds.c.raised }]}>
            <IconSymbol name="xmark" size={14} color={ds.c.ink} />
          </PressableScale>
        ) : null}
      </View>
      <View style={styles.head}>
        {drink ? <DrinkImage itemId={node.id} accessibilityLabel={`${node.name}, drawn`} radius="card" sketchDetail="thumb" style={styles.tile} /> : null}
        <View style={styles.flex}>
          <Title>{node.name}</Title>
          {aliases.length ? <Caption tone="muted">{`Also ${aliases.map((a) => a.alias).join(', ')}`}</Caption> : null}
        </View>
      </View>
      {meta ? <Body tone="muted">{meta}</Body> : null}
      {drink ? <Button label={`Open ${node.name}`} size="lg" onPress={() => router.push(drinkHref(node.id))} /> : null}

      {line.length ? (
        <Fact label="Descends from">
          <Chips items={line.map((n) => ({ key: n.key, label: [n.name, shortYear(n)].filter(Boolean).join(' · '), onPress: () => onSelect(n.key) }))} />
        </Fact>
      ) : null}
      {node.note ? (
        <Fact label="What changed">
          <Body>{node.note}</Body>
        </Fact>
      ) : null}
      {spec ? (
        <Fact label="Spec">
          <Spec>{spec}</Spec>
        </Fact>
      ) : null}
      {riffs.length ? (
        <Fact label={`Riffs on it · ${riffs.length}`}>
          <Chips items={riffs.map((n) => ({ key: n.key, label: n.name, onPress: () => onSelect(n.key) }))} />
        </Fact>
      ) : null}
      {node.versions ? (
        <Fact label={`Bar versions · ${node.versions}`}>
          <View role="list">
            {versions.map((v) => (
              <PressableScale
                key={v.id}
                role="link"
                accessibilityLabel={`${v.name}${v.bar ? `, ${v.bar}` : ''}${scores[v.id] != null ? `, score ${scores[v.id]}` : ''}`}
                onPress={() => router.push(drinkHref(v.id))}
                style={[styles.version, { borderBottomColor: ds.c.line }]}
              >
                <Body numberOfLines={1} style={styles.flex}>
                  {v.name}
                  {v.bar ? <Body tone="muted">{` · ${v.bar}`}</Body> : null}
                </Body>
                <RowScore score={scores[v.id]} />
              </PressableScale>
            ))}
          </View>
          {more > 0 ? <Link label={`${more} more version${more === 1 ? '' : 's'}`} onPress={() => router.push(drinkHref(node.id))} /> : null}
        </Fact>
      ) : null}
      {aliases.length || story?.books.length ? (
        <Fact label="Sources">
          {[...new Set(aliases.map((a) => a.source))].map((url) => (
            <Link key={url} label={shortUrl(url)} underline onPress={() => void Linking.openURL(url)} />
          ))}
          {(story?.books ?? []).map((b) => (
            <Link key={b.key} label={[b.title, b.year, b.author].filter(Boolean).join(', ')} underline onPress={() => router.push(bookHref(b.key))} />
          ))}
        </Fact>
      ) : null}
      {onTimeline ? <Link label="See it on the timeline" onPress={onTimeline} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  story: { gap: space.md + 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: -space.sm, marginRight: -space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2 },
  tile: { width: TILE, height: TILE },
  flex: { flex: 1, minWidth: 0 },
  label: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  fact: { gap: space.xs + 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
  chip: { minHeight: space.xxl, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingHorizontal: space.sm + 2, borderRadius: radius.pill, maxWidth: '100%' },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  version: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { alignSelf: 'flex-start', minHeight: space.xl, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
