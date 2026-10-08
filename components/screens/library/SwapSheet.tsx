import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Chip, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { useApplySwap, useSpecCatalog, useSwapSource, useUndoSwap } from '@/hooks/useBulk';
import { useVenueMenus } from '@/hooks/useMenus';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import type { CatalogItem } from '@/lib/match';
import { normName } from '@/lib/paste';
import { groupMenus } from '@/lib/menus';
import { planSwap, type SwapMode } from '@/lib/swapBottle';
import { space } from '@/constants/tokens';

interface Pick {
  id: string;
  name: string;
  genericId: string | null;
  genericName: string | null;
}

function search(query: string, catalog: CatalogItem[], venueId: string): CatalogItem[] {
  const want = normName(query);
  if (!want) return [];
  return catalog
    .filter((item) => normName(item.name).includes(want) && (item.barId === venueId || item.barId === null))
    .sort((a, b) => Number(b.barId === venueId) - Number(a.barId === venueId))
    .slice(0, 8);
}

function Picker({
  label,
  query,
  selected,
  results,
  onQuery,
  onPick,
  onClear,
}: {
  label: string;
  query: string;
  selected: Pick | null;
  results: CatalogItem[];
  onQuery: (value: string) => void;
  onPick: (item: CatalogItem) => void;
  onClear: () => void;
}) {
  if (selected) {
    return (
      <View style={{ gap: space.sm }}>
        <Caption tone="muted">{label}</Caption>
        <Choice label={selected.name} selected onPress={onClear} detail="Change" />
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      <Field label={label} value={query} onChangeText={onQuery} placeholder="Search ingredients" autoCapitalize="none" />
      {results.map((item) => (
        <Choice key={item.id} label={item.name} selected={false} onPress={() => onPick(item)} />
      ))}
    </View>
  );
}

/** Find a bottle or a kind, uncheck the drinks that stay, and swap the rest. */
export function SwapSheet({ barId, onClose }: { barId: string; onClose: () => void }) {
  const router = useRouter();
  const source = useSwapSource(barId);
  const { catalog } = useSpecCatalog();
  const menus = useVenueMenus(barId);
  const apply = useApplySwap();
  const undo = useUndoSwap();
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [find, setFind] = useState<Pick | null>(null);
  const [replace, setReplace] = useState<Pick | null>(null);
  const [mode, setMode] = useState<SwapMode>('kind');
  const [onMenu, setOnMenu] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [undone, setUndone] = useState<{ itemId: string; version: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const names = useMemo(() => {
    const map: Record<string, string> = { ...(source.data?.names ?? {}) };
    for (const item of catalog) map[item.id] = item.name;
    return map;
  }, [source.data?.names, catalog]);
  const onMenuIds = useMemo(() => {
    const ids = new Set<string>();
    for (const menu of groupMenus(menus.data ?? [], now).on) for (const id of menu.itemIds) ids.add(id);
    return ids;
  }, [menus.data, now]);

  const findId = find && mode === 'kind' && find.genericId ? find.genericId : (find?.id ?? '');
  const kindName = find ? (mode === 'kind' && find.genericName ? find.genericName : find.name) : '';
  const plan = useMemo(() => {
    if (!find || !replace || !source.data) return { hits: [], houses: [] };
    return planSwap(source.data.drinks, findId, replace.id, mode, onMenu ? onMenuIds : null, names, replace.name);
  }, [find, replace, source.data, findId, mode, onMenu, onMenuIds, names]);

  const chosen = plan.hits.filter((hit) => checked[hit.drink.id] !== false);
  const staying = plan.hits.filter((hit) => checked[hit.drink.id] === false).map((hit) => hit.drink.name);
  const pick = (item: CatalogItem): Pick => ({
    id: item.id,
    name: item.name,
    genericId: item.genericId,
    genericName: item.genericId ? (names[item.genericId] ?? null) : null,
  });

  const run = async () => {
    if (!find || !replace) return;
    const stay = staying.length ? `${staying.slice(0, 3).join(', ')} stay as they are. ` : '';
    const ok = await confirmAsync({
      title: `Swap ${chosen.length} ${chosen.length === 1 ? 'drink' : 'drinks'}?`,
      message: `${replace.name} replaces ${kindName} in ${chosen.length}. ${stay}Each drink keeps the old spec as a version. Guests still see the kind, not the brand.`,
      confirmText: 'Swap',
    });
    if (!ok) return;
    setError(null);
    const result = await apply.mutateAsync({
      drinks: chosen.map((hit) => hit.drink),
      findId,
      replaceId: replace.id,
      mode,
      note: `Swapped ${kindName} for ${replace.name}`,
    });
    setUndone(result.undone);
    setError(result.error);
  };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Swap a bottle"
      subtitle="This venue’s drinks. A house recipe is listed, not changed."
      footer={
        undone?.length ? (
          <Button
            label={undo.isPending ? 'Undoing…' : 'Undo this swap'}
            variant="secondary"
            onPress={() => undo.mutate(undone, { onSuccess: () => setUndone(null), onError: (e) => setError(plainDbMessage(e) ?? 'Couldn’t undo.') })}
          />
        ) : (
          <Button label={apply.isPending ? 'Swapping…' : `Swap ${chosen.length}`} onPress={run} disabled={!chosen.length || apply.isPending || !replace} />
        )
      }
    >
      <Picker
        label="Find"
        query={findQuery}
        selected={find}
        results={search(findQuery, catalog, barId)}
        onQuery={setFindQuery}
        onPick={(item) => {
          const next = pick(item);
          setFind(next);
          setMode(next.genericId ? 'bottle' : 'kind');
        }}
        onClear={() => setFind(null)}
      />
      {find ? (
        <View role="radiogroup" accessibilityLabel="How far the find reaches" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label={`Only ${find.name}`} selected={mode === 'bottle'} onPress={() => setMode('bottle')} />
          <Chip label={`Anything that’s ${find.genericName ?? find.name}`} selected={mode === 'kind'} onPress={() => setMode('kind')} />
        </View>
      ) : null}
      <Picker label="Replace with" query={replaceQuery} selected={replace} results={search(replaceQuery, catalog, barId)} onQuery={setReplaceQuery} onPick={(item) => setReplace(pick(item))} onClear={() => setReplace(null)} />
      {find && replace ? (
        <View role="radiogroup" accessibilityLabel="Which drinks" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label="Every drink here" selected={!onMenu} onPress={() => setOnMenu(false)} />
          <Chip label="On the menu that’s on" selected={onMenu} onPress={() => setOnMenu(true)} />
        </View>
      ) : null}
      {source.isLoading ? <Body tone="muted">Looking through the specs…</Body> : null}
      {find && replace && !source.isLoading && !plan.hits.length ? <Body tone="muted">No drinks pour {kindName}.</Body> : null}
      {plan.hits.map((hit) => (
        <Choice
          key={hit.drink.id}
          kind="checkbox"
          label={hit.drink.name}
          detail={hit.changes.map((change) => `${change.amount} ${change.from} → ${change.to}`.trim()).join(', ')}
          selected={checked[hit.drink.id] !== false}
          onPress={() => setChecked((prev) => ({ ...prev, [hit.drink.id]: prev[hit.drink.id] === false }))}
        />
      ))}
      {plan.houses.map((house) => (
        <Choice
          key={house.id}
          label={house.name}
          detail="House recipe. Open it to swap inside it."
          selected={false}
          onPress={() => {
            onClose();
            router.push(`/ingredient/${house.id}`);
          }}
        />
      ))}
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </MenuSheet>
  );
}
