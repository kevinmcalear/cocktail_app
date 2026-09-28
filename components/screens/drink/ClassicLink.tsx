import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useLinkClassic } from '@/hooks/useClassics';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useRankTarget } from '@/hooks/useRankings';
import { suggestClassic } from '@/lib/classics';
import { findDrinks } from '@/lib/discover';
import { plural } from '@/lib/ranking';

const MAX_CHOICES = 12;

/**
 * "Version of": links a venue's drink to the catalog classic it is, so it's
 * ranked with every other bar's version ("best Martini in New York"). Editors
 * only. Hidden for riffs on non-catalog drinks, which have their own family.
 */
export function ClassicLink({ item }: { item: { id: string; name: string; bar_id: string | null } }) {
  const { data: target, isLoading } = useRankTarget(item.id);
  const { data: catalog } = useDrinkLists();
  const link = useLinkClassic();
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');

  if (!item.bar_id || isLoading || !catalog?.length) return null;
  const linked = target?.riff_of?.is_catalog ? target.riff_of : null;
  if (target?.riff_of_id && !linked) return null;

  const save = (classicId: string | null) =>
    link.mutate([{ itemId: item.id, classicId }], {
      onSuccess: () => {
        setChoosing(false);
        setSearch('');
      },
      onError: () => {},
    });
  const suggestion = linked ? null : suggestClassic(item.name, catalog);

  let summary: string;
  let actions;
  if (linked) {
    summary = `A version of the ${linked.name}, ranked with every other bar's ${plural(linked.name)}.`;
    actions = (
      <>
        <Button label="Change" variant="secondary" onPress={() => setChoosing(!choosing)} />
        <Button label="Unlink" variant="ghost" disabled={link.isPending} onPress={() => save(null)} />
      </>
    );
  } else if (suggestion) {
    summary = `Is this a ${suggestion.classic.name}? Link it to rank it with every other bar's ${plural(suggestion.classic.name)}.`;
    actions = (
      <>
        <Button label={`Link to ${suggestion.classic.name}`} disabled={link.isPending} onPress={() => save(suggestion.classic.id)} />
        <Button label="Another classic" variant="ghost" onPress={() => setChoosing(!choosing)} />
      </>
    );
  } else {
    summary = "If this is a bar's take on a classic, link it so it's ranked with every other version.";
    actions = <Button label="Choose a classic" variant="secondary" onPress={() => setChoosing(!choosing)} />;
  }

  const choices = findDrinks(catalog, search).slice(0, MAX_CHOICES);
  return (
    <View style={styles.section}>
      <Headline role="heading">Version of</Headline>
      <Body tone="muted">{summary}</Body>
      <View style={styles.row}>{actions}</View>
      {choosing ? (
        <View style={styles.section}>
          <Field label="Find a classic" value={search} onChangeText={setSearch} placeholder="Martini, Negroni" autoCorrect={false} autoCapitalize="none" autoFocus />
          <View role="radiogroup" accessibilityLabel="Classic" style={styles.row}>
            {choices.map((c) => (
              <Chip key={c.id} label={c.name} selected={c.id === linked?.id} onPress={() => save(c.id)} />
            ))}
          </View>
          {search.trim() && !choices.length ? <Caption tone="muted">{`No classic called "${search.trim()}" in the catalog yet.`}</Caption> : null}
        </View>
      ) : null}
      {link.error ? <Caption tone="accent">{`Couldn't save the link: ${link.error.message}`}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
});
