import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Chip, useDs } from '@/components/ds';
import { LinkRow, Section, TechniqueRow } from '@/components/techniques/bits';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { canMake, EQUIPMENT, groupById, GROUPS, searchTechniques, TECHNIQUES, type Technique, type TechniqueGroup } from '@/lib/techniques';
import { useKit } from '@/hooks/useKit';

type Filter = 'kit' | 'vegan' | 'quick';

const FILTERS: { value: Filter; label: string; test: (t: Technique, kit: ReadonlySet<string>) => boolean }[] = [
  { value: 'kit', label: 'With my kit', test: canMake },
  { value: 'vegan', label: 'Vegan', test: (t) => t.vegan },
  { value: 'quick', label: 'Under an hour', test: (t) => t.totalMinutes <= 60 },
];

/**
 * The technique library: every advanced prep, grouped, searchable, and
 * filtered by the kit you have. `group` opens straight into one group (a prep
 * card's "Clarify" tag lands here).
 */
export function TechniquesScreen({ group }: { group?: string }) {
  const ds = useDs();
  const router = useRouter();
  const { kit } = useKit();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const only = groupById(group);

  const toggle = (f: Filter) => setFilters((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]));
  const shown = searchTechniques(query, only ? TECHNIQUES.filter((t) => t.group === only.id) : TECHNIQUES).filter((t) =>
    filters.every((f) => FILTERS.find((x) => x.value === f)!.test(t, kit)),
  );
  const flat = !!query.trim() || !!filters.length;
  const groups: TechniqueGroup[] = only ? [only.id] : GROUPS.map((g) => g.id);

  return (
    <TechniquePage
      eyebrow={only ? 'Techniques' : undefined}
      title={only ? only.name : 'Techniques'}
      intro={<Body tone="muted">{only ? only.blurb : 'How to make anything behind the bar: steps, doses scaled to your batch, the kit, and where each number comes from.'}</Body>}
    >
      <View style={styles.tools}>
        <View style={[styles.search, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
          <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Foam, clarify, milk punch, iSi…"
            placeholderTextColor={ds.c.muted}
            aria-label="Search techniques"
            autoCorrect={false}
            style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
          />
        </View>
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} multi selected={filters.includes(f.value)} onPress={() => toggle(f.value)} />
          ))}
        </View>
        {filters.includes('kit') && !kit.size ? <Body tone="muted">Tell us what equipment you have first.</Body> : null}
      </View>

      {!only && !flat ? (
        <View style={styles.cards}>
          <LinkRow title="Foam from anything" detail="Four questions, one foamer to start with" href="/techniques/foam" icon="sparkles" />
          <LinkRow title="Equipment" detail={kit.size ? `You have ${kit.size} of ${EQUIPMENT.length}` : 'Tell us what you have'} href="/equipment" icon="hammer.fill" />
        </View>
      ) : null}

      {flat ? (
        <Section title={`${shown.length} ${shown.length === 1 ? 'technique' : 'techniques'}`}>
          {shown.length ? shown.map((t) => <TechniqueRow key={t.id} t={t} kit={kit} />) : <Body tone="muted">Nothing matches. Try fewer words or another filter.</Body>}
        </Section>
      ) : (
        groups.map((g) => {
          const list = shown.filter((t) => t.group === g);
          return list.length ? (
            <Section key={g} title={only ? `${list.length} techniques` : groupById(g)!.name}>
              {list.map((t) => (
                <TechniqueRow key={t.id} t={t} kit={kit} />
              ))}
            </Section>
          ) : null;
        })
      )}

      {only ? <Button label="All techniques" variant="secondary" onPress={() => router.replace('/techniques' as never)} /> : null}
    </TechniquePage>
  );
}

const styles = StyleSheet.create({
  tools: { gap: space.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg },
  input: { flex: 1, minHeight: layout.minTapTarget },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cards: { gap: space.sm },
});
