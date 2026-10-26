import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Field, FieldButton, IngredientThumb, Title } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { space } from '@/constants/tokens';
import { KIND_PAGE, useKindBottles, type FoundItem } from '@/hooks/useHomeBar';
import { kindName, leftOutLine } from '@/lib/myBarAdd';
import { foundLine } from '@/lib/myBarText';

import { Result, TileLink } from './AddToBarParts';

interface WhichKindProps {
  kind: FoundItem;
  /** The style is on your bar, or a bottle picked here took its place. */
  swapped: boolean;
  /** On your bar now. */
  has: (id: string) => boolean;
  /** Listed: not on your bar, or picked since the sheet opened. */
  shown: (id: string) => boolean;
  onPick: (bottle: FoundItem, on: boolean) => void;
}

/**
 * "Which gin?" inside Add to your bar (wave 2, Q7, option A): the kind's
 * bottles in the catalog with their photos, and a search. A bottle ticked
 * here takes the style's place on your bar (AddToBarSheet does the swap).
 */
export function WhichKind({ kind, swapped, has, shown, onPick }: WhichKindProps) {
  const [query, setQuery] = useState('');
  const bottles = useKindBottles(kind.id, query);
  const one = kindName(kind.name);
  const many = kindName(kind.name, true);
  const all = bottles.data ?? [];
  const rows = all.filter((b) => shown(b.id));
  const left = leftOutLine(all.filter((b) => !shown(b.id)).map((b) => b.name));
  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <Title>{`Which ${one}?`}</Title>
        <Body tone="muted">
          {swapped ? `${kind.name} is on your bar. Tick the bottles you have and they take its place. Every ${one} drink still counts.` : `Tick the bottles you have. Every ${one} drink counts them.`}
        </Body>
      </View>
      <Field
        label={`Search ${many}`}
        hideLabel
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${many}`}
        icon="magnifyingglass"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        trailing={query ? <FieldButton icon="xmark.circle.fill" label="Clear search" onPress={() => setQuery('')} /> : null}
      />
      <View style={styles.list}>
        <Eyebrow>{`${many.charAt(0).toUpperCase()}${many.slice(1)} in the catalog`}</Eyebrow>
        {left ? <Body tone="muted">{left}</Body> : null}
        {bottles.error && !all.length ? (
          <Body tone="muted">Couldn’t load them right now. Check your connection and try again.</Body>
        ) : !all.length ? (
          <Body tone="muted">{bottles.isFetching || bottles.isPending ? 'Looking…' : query.trim() ? `No ${one} called “${query.trim()}” yet.` : `No ${many} in the catalog yet.`}</Body>
        ) : (
          rows.map((b) => (
            <Result
              key={b.id}
              name={b.name}
              sub={foundLine(b)}
              query={query.trim()}
              thumb={<IngredientThumb id={b.id} name={b.name} size={48} />}
              has={has(b.id)}
              onToggle={(on) => onPick(b, on)}
            />
          ))
        )}
        {all.length >= KIND_PAGE ? <Body tone="muted">{`Search to find more ${many}.`}</Body> : null}
      </View>
    </View>
  );
}

/** Under a ticked style's tile: "Which gin?", only when the catalog has bottles of it. */
export function WhichLink({ kind, onOpen }: { kind: FoundItem; onOpen: () => void }) {
  const { data } = useKindBottles(kind.id);
  if (!data?.length) return null;
  return <TileLink label={`Which ${kindName(kind.name)}?`} a11y={`Which ${kindName(kind.name)}? Pick the bottle you have`} onPress={onOpen} />;
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  head: { gap: space.xs },
  list: { gap: space.xs, minHeight: 320 },
});
