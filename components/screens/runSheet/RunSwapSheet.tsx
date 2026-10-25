import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Spec, useDs } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { NearPicks } from '@/components/search/NearPicks';
import { radius, space } from '@/constants/tokens';
import { useSpecCatalog } from '@/hooks/useBulk';
import { useNearIngredients } from '@/hooks/useNearIngredients';
import { useSetSwaps, type RunSheetData } from '@/hooks/useRunSheet';
import { normName } from '@/lib/paste';
import type { RunDrink, SheetLine } from '@/lib/runSheet';

const andList = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * Swap one bottle or garnish in one drink, for this menu only (board 2a): the
 * brands on the sheet first, then bottles of the same kind, or search. The
 * library spec never changes. Optionally swaps it in the menu's other drinks
 * that pour the same thing.
 */
export function RunSwapSheet({ data, drink, line, onClose }: { data: RunSheetData; drink: RunDrink; line: SheetLine; onClose: () => void }) {
  const ds = useDs();
  const { catalog } = useSpecCatalog();
  const setSwaps = useSetSwaps(data.menu.id);
  const from = line.was ?? { id: line.ingredientId, name: line.name };
  const kindId = data.items[from.id]?.genericId ?? from.id;
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<{ id: string; name: string }>({ id: line.ingredientId, name: line.name });
  const [alsoOthers, setAlsoOthers] = useState(true);

  const brands = data.brandBottles.filter((b) => b.genericId === kindId || b.id === kindId || b.genericId === from.id);
  const others = data.drinks.filter((d) => d.id !== drink.id && d.recipe.some((l) => l.ingredientId === from.id));
  const results = useMemo(() => {
    const want = normName(query);
    const mine = (barId: string | null) => barId === null || barId === data.menu.barId;
    const hits = want
      ? catalog.filter((c) => mine(c.barId) && normName(c.name).includes(want))
      : catalog.filter((c) => mine(c.barId) && (c.genericId === kindId || c.id === kindId));
    return hits.filter((c) => c.id !== from.id && !brands.some((b) => b.id === c.id)).slice(0, 8);
  }, [catalog, query, kindId, from.id, brands, data.menu.barId]);
  const pool = useMemo(() => catalog.filter((c) => c.id !== from.id && (c.barId === null || c.barId === data.menu.barId)), [catalog, from.id, data.menu.barId]);
  const near = useNearIngredients(query, pool, { skip: !query.trim(), shown: results });

  const save = () => {
    const to = chosen.id === from.id ? null : chosen;
    const drinks = [drink, ...(alsoOthers ? others : [])];
    setSwaps.mutate(drinks.map((d) => ({ menuDrinkId: d.id, fromItemId: from.id, to })));
    onClose();
  };
  const pick = (id: string, name: string, detail: string) => (
    <Choice key={id} label={name} detail={detail} selected={chosen.id === id} onPress={() => setChosen({ id, name })} />
  );

  return (
    <MenuSheet
      visible
      onClose={onClose}
      eyebrow={`${drink.name} · this menu only`}
      title={`Swap ${from.name}`}
      footer={
        <View style={{ gap: space.sm }}>
          <Button label={chosen.id === from.id && line.was ? `Put back ${from.name}` : 'Swap for this menu'} onPress={save} disabled={chosen.id === line.ingredientId && !(alsoOthers && others.length)} />
          <Caption tone="muted" align="center">
            The {drink.name} in your library keeps {from.name}.
          </Caption>
        </View>
      }
    >
      <View style={{ gap: space.md }}>
        <Field label={`Search for something else`} hideLabel value={query} onChangeText={setQuery} placeholder="Search bottles and garnishes" icon="magnifyingglass" autoCapitalize="none" />
        {brands.length && !query ? (
          <View style={{ gap: space.sm }}>
            <Caption tone="muted">From the brands on this sheet</Caption>
            {brands.map((b) => pick(b.id, b.name, [data.parties.find((p) => p.id === b.partyId)?.name, b.kindName].filter(Boolean).join(' · ')))}
          </View>
        ) : null}
        <View style={{ gap: space.sm }}>
          <Caption tone="muted">{query ? 'Found' : 'More like it'}</Caption>
          {query ? null : pick(from.id, from.name, 'In the spec now')}
          {results.map((r) => pick(r.id, r.name, r.barId ? 'Your bar' : 'Catalog'))}
          <NearPicks found={results.length > 0} near={near} render={(r) => pick(r.id, r.name, r.barId ? 'Your bar' : 'Catalog')} />
          {query && !results.length && !near.length ? <Body tone="muted">Nothing called that yet.</Body> : null}
        </View>
        {others.length ? (
          <Choice
            kind="checkbox"
            label={`Also swap it in ${andList(others.map((o) => o.name))}`}
            detail={`They pour ${from.name} too`}
            selected={alsoOthers}
            onPress={() => setAlsoOthers((v) => !v)}
          />
        ) : null}
        {line.per ? (
          <View style={[styles.amount, { backgroundColor: ds.c.raised }]}>
            <Caption tone="muted">Amount stays</Caption>
            <Spec>{line.per}</Spec>
          </View>
        ) : null}
      </View>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  amount: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md, borderRadius: radius.control },
});
