import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Chip, PressableScale, Spec, Surface, useDs } from '@/components/ds';
import { FoamPicker } from '@/components/techniques/FoamPicker';
import { LinkRow, Section, TechniqueRow } from '@/components/techniques/bits';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { TechniqueSheet } from '@/components/techniques/TechniqueSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useKitHere } from '@/hooks/useBarKit';
import { canMake, groupById, GROUPS, searchTechniques, TECHNIQUES, type Technique } from '@/lib/techniques';
import { membersLine } from '@/lib/techniques/facts';

type Filter = 'kit' | 'vegan' | 'quick';

const FILTERS: { value: Filter; label: string; test: (t: Technique, kit: ReadonlySet<string>) => boolean }[] = [
  { value: 'kit', label: 'With my kit', test: canMake },
  { value: 'vegan', label: 'Vegan', test: (t) => t.vegan },
  { value: 'quick', label: 'Under an hour', test: (t) => t.totalMinutes <= 60 },
];

/**
 * The technique library: one row per group, searchable, and filtered by the
 * kit you have. `group` opens straight into one group (a prep card's
 * "Clarify" tag lands here); `foam` opens Foam from anything over it.
 */
export function TechniquesScreen({ group, foam = false }: { group?: string; foam?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const kit = useKitHere();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [foamOpen, setFoamOpen] = useState(foam);
  const only = groupById(group);

  const toggle = (f: Filter) => setFilters((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]));
  const pool = only ? TECHNIQUES.filter((t) => t.group === only.id) : TECHNIQUES;
  const shown = searchTechniques(query, pool)
    .filter((t) => filters.every((f) => FILTERS.find((x) => x.value === f)!.test(t, kit)))
    // Once you've said what you have, what needs something else moves to the end.
    .sort((a, b) => (kit.size ? Number(canMake(b, kit)) - Number(canMake(a, kit)) : 0));
  const flat = !!query.trim() || !!filters.length;
  const counts: Partial<Record<Filter, number>> = { kit: pool.filter((t) => canMake(t, kit)).length };

  return (
    <TechniquePage
      eyebrow={only ? 'Techniques' : undefined}
      title={only ? only.name : 'Techniques'}
      intro={<Body tone="muted">{only ? only.blurb : 'How to make anything behind the bar: steps, doses scaled to your batch, the kit, and where each number comes from.'}</Body>}
      footer={<KitBar tools={kit.size} />}
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
        <View role="group" aria-label="Show" style={styles.chips}>
          <Chip label="All" count={pool.length} multi selected={!filters.length} onPress={() => setFilters([])} />
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} count={counts[f.value]} multi selected={filters.includes(f.value)} onPress={() => toggle(f.value)} />
          ))}
        </View>
        {filters.includes('kit') && !kit.size ? <Body tone="muted">Tell us what equipment you have first.</Body> : null}
      </View>

      {only?.id === 'foam' && !flat ? <LinkRow title="Foam from anything" detail="Four questions, one foamer to start with" href="/techniques/foam" icon="sparkles" onPress={() => setFoamOpen(true)} /> : null}

      {flat || only ? (
        <Section title={`${shown.length} ${shown.length === 1 ? 'technique' : 'techniques'}`}>
          {shown.length ? shown.map((t) => <TechniqueRow key={t.id} t={t} kit={kit} />) : <Body tone="muted">Nothing matches. Try fewer words or another filter.</Body>}
        </Section>
      ) : (
        <Surface style={styles.groups}>
          {GROUPS.map((g, i) => {
            const list = TECHNIQUES.filter((t) => t.group === g.id);
            return (
              <PressableScale
                key={g.id}
                role="link"
                accessibilityLabel={`${g.name}, ${list.length} techniques: ${membersLine(list.map((t) => t.name))}`}
                onPress={() => router.push(`/techniques?group=${g.id}` as never)}
                style={[styles.group, i < GROUPS.length - 1 && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <View style={[styles.icon, { backgroundColor: ds.c.raised }]}>
                  <IconSymbol name={g.icon} size={18} color={ds.c.ink} />
                </View>
                <View style={styles.flex}>
                  <Body>{g.name}</Body>
                  <Caption tone="muted" numberOfLines={2}>
                    {membersLine(list.map((t) => t.name))}
                  </Caption>
                </View>
                <Spec tone="muted">{String(list.length)}</Spec>
                <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
              </PressableScale>
            );
          })}
        </Surface>
      )}

      {only ? <Button label="All techniques" variant="secondary" onPress={() => router.replace('/techniques' as never)} /> : null}

      <TechniqueSheet visible={foamOpen} onClose={() => setFoamOpen(false)} eyebrow="Make a foam" title="Foam from anything">
        <FoamPicker />
      </TechniqueSheet>
    </TechniquePage>
  );
}

/** Pinned at the bottom: how much kit you've said you have, and Edit to change it. */
function KitBar({ tools }: { tools: number }) {
  const ds = useDs();
  const router = useRouter();
  return (
    // A floating ink pill, cream words (prep-tech-index).
    <PressableScale role="link" accessibilityLabel={`My kit, ${tools} ${tools === 1 ? 'tool' : 'tools'}. Edit`} onPress={() => router.push('/equipment' as never)} style={[styles.kit, { backgroundColor: ds.c.ink }]}>
      <IconSymbol name="hammer.fill" size={18} color={ds.c.ground} />
      <Body color={ds.c.ground} style={[styles.flex, styles.strong]}>{tools ? `My kit · ${tools} ${tools === 1 ? 'tool' : 'tools'}` : 'My kit · tell us what you have'}</Body>
      <Body color={ds.c.ground}>Edit</Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tools: { gap: space.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg },
  input: { flex: 1, minHeight: layout.minTapTarget },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  groups: { paddingVertical: 0 },
  group: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.lg, paddingVertical: space.sm },
  icon: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  kit: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%', maxWidth: 760, alignSelf: 'center', minHeight: layout.minTapTarget + space.md, paddingHorizontal: space.xl, borderRadius: radius.pill, borderCurve: 'continuous' },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
