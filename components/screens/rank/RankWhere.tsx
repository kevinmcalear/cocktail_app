import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Chip, PressableScale, useDs } from '@/components/ds';
import { AddBarForm } from '@/components/screens/home/AddBar';
import { NearPicks, splitNear } from '@/components/search/NearPicks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, type } from '@/constants/tokens';
import { usePublicBars, type RankVenue } from '@/hooks/useRankings';

interface WhereProps {
  /** The drink's own bar, if it has a public page. */
  ownBar: RankVenue | null;
  /** Where it was had; null is home. */
  value: RankVenue | null;
  onChange: (v: RankVenue | null) => void;
}

/**
 * "Bar Leone · tonight" under How was it (Prod-rank-A). A tap opens the
 * picker, so a classic ranked from its own page can still be put at the bar
 * it was had at, or a bar's drink at home.
 */
export function WhereLine({ ownBar, value, onChange }: WhereProps) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.where}>
      <PressableScale aria-expanded={open} accessibilityLabel={`Had at ${value?.display_name ?? 'home'} tonight. Change where`} onPress={() => setOpen(!open)} style={styles.line}>
        <Body tone="muted" align="center">{`${value?.display_name ?? 'Home'} · tonight`}</Body>
        <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.muted} />
      </PressableScale>
      {open ? (
        <WherePicker
          ownBar={ownBar}
          value={value}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

/** The drink's own bar, at home, or another public bar found by name (or added). */
function WherePicker({ ownBar, value, onChange }: WhereProps) {
  const ds = useDs();
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [plain, near] = splitNear(usePublicBars(search, { near: true }).data ?? []);
  const other = value && value.id !== ownBar?.id ? value : null;
  const pickChip = (v: RankVenue) => (
    <Chip
      key={v.id}
      label={v.locality ? `${v.display_name}, ${v.locality}` : v.display_name}
      selected={value?.id === v.id}
      onPress={() => {
        onChange(v);
        setSearching(false);
        setSearch('');
      }}
    />
  );
  return (
    <View style={styles.where}>
      <View style={styles.chips}>
        <View role="radiogroup" aria-label="Where did you have it?" style={styles.chips}>
          {ownBar ? <Chip label={`At ${ownBar.display_name}`} selected={value?.id === ownBar.id} onPress={() => onChange(ownBar)} /> : null}
          <Chip label="At home" selected={value === null} onPress={() => onChange(null)} />
          {other ? <Chip label={`At ${other.display_name}`} selected onPress={() => onChange(other)} /> : null}
        </View>
        <PressableScale aria-expanded={searching} accessibilityLabel="Another bar" onPress={() => setSearching(!searching)} style={[styles.chip, { backgroundColor: ds.c.raised }]}>
          <Caption>Another bar</Caption>
        </PressableScale>
      </View>
      {searching ? (
        <View style={styles.where}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search bars by name"
            placeholderTextColor={ds.c.muted}
            accessibilityLabel="Search bars by name"
            autoFocus
            autoCorrect={false}
            style={[styles.input, { color: ds.c.ink, backgroundColor: ds.c.raised }]}
          />
          <View style={styles.chips}>
            {plain.map(pickChip)}
            {search.trim().length >= 2 && !plain.length && !near.length ? <Caption tone="muted">No public bars match.</Caption> : null}
          </View>
          <NearPicks found={plain.length > 0} near={near} no="No, it’s somewhere else" render={pickChip} rowStyle={styles.chips}>
            {search.trim().length >= 2 && !adding ? <Button label="Not here? Add it" icon="plus" variant="ghost" onPress={() => setAdding(true)} /> : null}
          </NearPicks>
          {adding ? (
            <AddBarForm
              initialName={search.trim()}
              onCancel={() => setAdding(false)}
              onAdded={(v) => {
                onChange(v);
                setAdding(false);
                setSearching(false);
                setSearch('');
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  where: { gap: space.sm, alignSelf: 'stretch' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: layout.minTapTarget },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
  input: { ...type.body, ...font.regular, minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.control },
});
