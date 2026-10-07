import { useRef, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { kindsTitle, type DiscoverBar, type DiscoverDrink } from '@/lib/discoverDrinks';
import type { Area } from '@/lib/nearMe';

import { DiscoverOverlay } from './DiscoverSheet';
import { DiscoverSearchResults } from './DiscoverSearchResults';

export type SearchScope = 'here' | 'everywhere';

interface DiscoverSearchSheetProps {
  query: string;
  onQuery: (query: string) => void;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  /** What "here" is called: "This area" on the map, else the area chip's words ("Near you", "London"). Null when here is everywhere. */
  hereLabel: string | null;
  /** The area the results are in, after the scope. */
  area: Area;
  /** The filters picked, which narrow the search too. */
  kinds: readonly string[];
  onClearKinds: () => void;
  results: { drinks: DiscoverDrink[]; bars: DiscoverBar[]; barsById: ReadonlyMap<string, DiscoverBar>; isLoading: boolean };
  signedIn: boolean;
  /** A style or spirit the search named: filter by it and close. */
  onKind: (kind: string) => void;
  onClose: () => void;
}

/** This area or Everywhere: a two-way switch, the picked side filled. */
function ScopeSwitch({ scope, onScope, hereLabel }: { scope: SearchScope; onScope: (s: SearchScope) => void; hereLabel: string }) {
  const ds = useDs();
  const options = [
    { value: 'here' as const, label: hereLabel },
    { value: 'everywhere' as const, label: 'Everywhere' },
  ];
  return (
    <View role="tablist" accessibilityLabel="Where to search" style={[styles.switch, { backgroundColor: ds.c.surface }]}>
      {options.map((o) => {
        const on = scope === o.value;
        return (
          <PressableScale
            key={o.value}
            role="tab"
            aria-selected={on}
            accessibilityLabel={o.label}
            onPress={() => onScope(o.value)}
            style={[styles.side, on && { backgroundColor: ds.accentFill.fill }]}
          >
            <DsText variant="body" color={on ? ds.accentFill.text : ds.c.muted} style={on ? styles.bold : null} numberOfLines={1}>
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * Discover's ⌘K: one field for bars and the drinks bars pour, in this area
 * (what the map shows) or everywhere. What's typed also narrows the list and
 * map behind, so Done keeps the search.
 */
export function DiscoverSearchSheet({ query, onQuery, scope, onScope, hereLabel, area, kinds, onClearKinds, results, signedIn, onKind, onClose }: DiscoverSearchSheetProps) {
  const ds = useDs();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const q = query.trim();

  const head = (
    <>
      <View style={styles.row}>
        <View style={[styles.field, { backgroundColor: ds.c.raised, borderColor: ds.accentText }]}>
          <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
          <TextInput
            ref={input}
            value={query}
            onChangeText={onQuery}
            placeholder={scope === 'here' && hereLabel === 'This area' ? 'Search this area' : 'Search bars and drinks'}
            placeholderTextColor={ds.c.muted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={onClose}
            accessibilityLabel="Search bars and drinks"
            style={[styles.input, { color: ds.c.ink }]}
          />
          {q ? (
            <PressableScale
              accessibilityLabel="Clear the search"
              onPress={() => {
                onQuery('');
                input.current?.focus();
              }}
              style={styles.clear}
            >
              <IconSymbol name="xmark.circle.fill" size={22} color={ds.c.muted} />
            </PressableScale>
          ) : null}
        </View>
        <Button label="Done" variant="ghost" onPress={onClose} />
      </View>
      {hereLabel ? <ScopeSwitch scope={scope} onScope={onScope} hereLabel={hereLabel} /> : null}
      {kinds.length ? (
        <View style={styles.row}>
          <Caption tone="muted" style={styles.flex}>{`With your filters: ${kindsTitle(kinds)}`}</Caption>
          <Button label="Clear filters" variant="ghost" onPress={onClearKinds} />
        </View>
      ) : null}
    </>
  );

  return (
    <DiscoverOverlay label="Search" full onClose={onClose} head={head}>
      {q ? (
        <>
          <DiscoverSearchResults
            search={query}
            area={area}
            drinks={results.drinks}
            bars={results.bars}
            barsById={results.barsById}
            isLoading={results.isLoading}
            signedIn={signedIn}
            onKind={onKind}
          />
          {hereLabel && scope === 'here' ? <Button label={`Search everywhere for “${q}”`} variant="secondary" onPress={() => onScope('everywhere')} /> : null}
        </>
      ) : (
        <Caption tone="muted">{"Search a bar's name, a drink, an ingredient, a style or a city."}</Caption>
      )}
    </DiscoverOverlay>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTapTarget + space.xs,
    paddingLeft: space.lg,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  // The field's accent border shows focus, so the browser's own ring is off.
  input: { ...type.body, fontFamily: fontFamilies.body, flex: 1, minWidth: 0, paddingVertical: space.md, outlineWidth: 0 },
  clear: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  switch: { flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.pill },
  side: { flex: 1, minHeight: layout.minTapTarget - space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  bold: { fontFamily: fontFamilies.bodySemiBold },
});
