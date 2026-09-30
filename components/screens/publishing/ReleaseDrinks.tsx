import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Field, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { PUBLISH_COPY, type PublishMode } from '@/lib/publishing';

import { Choice } from '../menus/MenuSheet';

// Past this many, a search box helps (Bar Bellamy has over a hundred drinks).
const SEARCH_FROM = 12;

interface ReleaseDrinksProps {
  drinks: { id: string; name: string; mode: PublishMode }[];
  /** In release order. */
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Pick a release's drinks: chosen ones first, in the order they were added, then the rest by name. */
export function ReleaseDrinks({ drinks, selected, onChange }: ReleaseDrinksProps) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const byId = new Map(drinks.map((d) => [d.id, d]));
  const chosen = selected.map((id) => byId.get(id)).filter((d): d is (typeof drinks)[number] => !!d);
  const rest = drinks.filter((d) => !selected.includes(d.id) && (!q || d.name.toLowerCase().includes(q)));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const row = (d: (typeof drinks)[number]) => (
    <Choice
      key={d.id}
      kind="checkbox"
      label={d.name}
      detail={d.mode === 'private' ? 'Private: publish it before the release goes out' : PUBLISH_COPY[d.mode].label}
      selected={selected.includes(d.id)}
      onPress={() => toggle(d.id)}
    />
  );

  return (
    <View style={styles.group}>
      <Headline role="heading">{`Drinks (${chosen.length})`}</Headline>
      {drinks.length ? null : <Caption tone="muted">This venue has no drinks yet.</Caption>}
      <View role="group" accessibilityLabel="Drinks in this release" style={styles.list}>
        {chosen.map(row)}
      </View>
      {drinks.length > SEARCH_FROM ? <Field label="Find a drink" value={search} onChangeText={setSearch} autoCapitalize="none" /> : null}
      <View role="group" accessibilityLabel="Other drinks at the venue" style={styles.list}>
        {rest.map(row)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  list: { gap: space.sm },
});
