import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Chip, Field, GlassButton, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useDrinkTree } from '@/hooks/useDrinkTree';
import { FAMILIES, familyFor, familyRows, pathTo, rowMeta, searchTree, type FamilyKey } from '@/lib/drinkTree';

import { TreeRowView } from './TreeRowView';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;

/** Every classic's family tree, one family at a time, back to the punch bowl. Opened with ?focus=<drink id> from a drink page. */
export function HistoryScreen() {
  return (
    <BackbarTheme>
      <HistoryPage />
    </BackbarTheme>
  );
}

function HistoryPage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const { data: nodes = [], isLoading, isError } = useDrinkTree();
  const [family, setFamily] = useState<FamilyKey | null>(null);
  const [folded, setFolded] = useState<string[]>([]);
  // undefined: the drink in ?focus=, until something else is picked.
  const [picked, setFocusKey] = useState<string | null | undefined>(undefined);
  const [query, setQuery] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const rowY = useRef(new Map<string, number>());
  const listY = useRef(0);

  const focusKey = picked !== undefined ? picked : (nodes.find((n) => n.id === params.focus || n.key === params.focus)?.key ?? null);
  const current = family ?? familyFor(nodes, params.focus);
  const rows = familyRows(nodes, current, new Set(folded));
  const results = searchTree(nodes, query);
  const drinks = nodes.filter((n) => n.kind === 'drink').length;
  const meta = FAMILIES.find((f) => f.key === current)!;
  const foldable = rows.filter((r) => r.hasKids && r.depth > 0).map((r) => r.node.key);

  // Bring the focused row into view after it has been laid out.
  useEffect(() => {
    if (!focusKey) return;
    const t = setTimeout(() => {
      const y = rowY.current.get(focusKey);
      if (y != null) scroll.current?.scrollTo({ y: Math.max(0, listY.current + y - 160), animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [focusKey, current]);

  const jump = (key: string) => {
    const target = nodes.find((n) => n.key === key);
    if (!target) return;
    const path = new Set(pathTo(nodes, key));
    setFolded((f) => f.filter((k) => !path.has(k)));
    if (FAMILIES.some((f) => f.key === target.family)) setFamily(target.family as FamilyKey);
    setFocusKey(key);
    setQuery('');
  };
  const toggle = (key: string) => setFolded((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter },
        ]}
      >
        <View style={styles.header}>
          <Title>Cocktail history</Title>
          <Body tone="muted">
            {drinks
              ? `${drinks} classics and modern classics, each traced back through the drink it came from to the punch bowl. Tap a drink to open it, fold a line with the arrow, or follow "from" into another family.`
              : 'Every classic, traced back through the drink it came from to the punch bowl.'}
          </Body>
        </View>

        <Field label="Find a drink, bartender or bar" value={query} onChangeText={setQuery} placeholder="Penicillin, Ada Coleman, Pegu Club" autoCorrect={false} autoCapitalize="none" />
        {query.trim() ? (
          <View role="list" aria-label="Matches">
            {results.length ? (
              results.map((n) => (
                <PressableScale key={n.key} role="button" accessibilityLabel={`Show ${n.name} in the tree`} onPress={() => jump(n.key)} style={[styles.result, { borderBottomColor: ds.c.line }]}>
                  <Body numberOfLines={1}>{n.name}</Body>
                  <Caption tone="muted" numberOfLines={1}>
                    {[FAMILIES.find((f) => f.key === n.family)?.name, rowMeta(n)].filter(Boolean).join(' · ')}
                  </Caption>
                </PressableScale>
              ))
            ) : (
              <Caption tone="muted">{`Nothing in the tree matches "${query.trim()}".`}</Caption>
            )}
          </View>
        ) : null}

        <View role="radiogroup" accessibilityLabel="Family" style={styles.chips}>
          {FAMILIES.map((f) => (
            <Chip
              key={f.key}
              label={f.name}
              selected={f.key === current}
              onPress={() => {
                setFamily(f.key);
                setFocusKey(null);
              }}
            />
          ))}
        </View>

        <View style={styles.familyHead}>
          <View style={styles.flex}>
            <Caption tone="muted">{`${meta.blurb} ${rows.filter((r) => r.node.kind === 'drink').length} drinks shown.`}</Caption>
          </View>
          {foldable.length || folded.length ? (
            <Button
              label={folded.length ? 'Show every line' : 'Main lines only'}
              variant="ghost"
              onPress={() => setFolded(folded.length ? [] : foldable)}
            />
          ) : null}
        </View>

        {isLoading ? <Caption tone="muted">Loading the family tree…</Caption> : null}
        {isError ? <Caption tone="muted">{"The family tree didn't load. Go back and try again."}</Caption> : null}
        {!isLoading && !isError && !rows.length ? <Caption tone="muted">No drinks in this family yet.</Caption> : null}

        <View role="list" aria-label={`${meta.name} family tree`} onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
          {rows.map((r) => (
            <View key={r.node.key} onLayout={(e) => rowY.current.set(r.node.key, e.nativeEvent.layout.y)}>
              <TreeRowView
                row={r}
                folded={folded.includes(r.node.key)}
                focused={r.node.key === focusKey}
                onOpen={() => router.push(drinkHref(r.node.id))}
                onToggle={() => toggle(r.node.key)}
                onJump={jump}
              />
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: space.lg },
  header: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  familyHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  result: { minHeight: layout.minTapTarget + space.sm, justifyContent: 'center', paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { position: 'absolute' },
});
