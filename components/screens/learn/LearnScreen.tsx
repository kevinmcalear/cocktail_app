import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, EquipmentThumb, GlassButton, PressableScale, useDs } from '@/components/ds';
import { SettingsRow } from '@/components/screens/settings/SettingsParts';
import { Group, Section } from '@/components/techniques/bits';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, palateHues, radius, space } from '@/constants/tokens';
import { useKitHere } from '@/hooks/useBarKit';
import { useCoreIngredients, usePairings } from '@/hooks/usePairings';
import { EQUIPMENT, GROUPS, TECHNIQUES } from '@/lib/techniques';
import { kitPicks, pairLine, pickOfDay, type KitPick } from '@/lib/techniques/learn';

/** The five groups Kept-learn draws on the hub, in its order; All opens the other eight. */
const HUB_GROUPS = ['cold', 'clarify', 'foam', 'infuse', 'preserve'].flatMap((id) => GROUPS.filter((g) => g.id === id));

/**
 * Learn (Kept-learn, "Learn, from Discover"): techniques by group, the kit
 * that matters to you, and a pairing from the flavour map. Reached from
 * Discover and, for staff, from Tonight's Learn.
 */
export function LearnScreen() {
  const router = useRouter();
  const kit = useKitHere();
  const go = (href: string) => () => router.push(href as Href);
  return (
    <TechniquePage
      inTabs
      eyebrow="Techniques, kit and pairings"
      title="Learn"
      crumbs={[{ label: 'Discover', href: '/discover' }]}
      actions={<GlassButton icon="magnifyingglass" accessibilityLabel="Search Learn" onPress={go('/techniques?search=1')} />}
    >
      <Section title="Techniques" aside={`All ${TECHNIQUES.length}`} onAside={go('/techniques')}>
        <Group>
          {HUB_GROUPS.map((g) => (
            <SettingsRow key={g.id} icon={g.icon} label={g.name} detail={g.blurb} value={String(TECHNIQUES.filter((t) => t.group === g.id).length)} onPress={go(`/techniques?group=${g.id}`)} />
          ))}
        </Group>
      </Section>
      <Section title="Equipment" aside={`All ${EQUIPMENT.length}`} onAside={go('/equipment')}>
        <View role="list">
          {kitPicks(kit).map((p) => (
            <KitRow key={p.id} pick={p} onPress={go(`/equipment/${p.id}`)} />
          ))}
        </View>
      </Section>
      <Section title="Pairings">
        <PairNote />
      </Section>
    </TechniquePage>
  );
}

/** A piece of kit: its drawing, its name in the display face, and On your shelf with Have it, or what it would open. */
function KitRow({ pick, onPress }: { pick: KitPick; onPress: () => void }) {
  const ds = useDs();
  const sub = pick.have ? 'On your shelf' : `Unlocks ${pick.opens} ${pick.opens === 1 ? 'technique' : 'techniques'}`;
  return (
    <PressableScale role="link" accessibilityLabel={`${pick.name}. ${sub}${pick.have ? '. You have it' : ''}`} onPress={onPress} style={styles.kit}>
      <View style={[styles.pic, { backgroundColor: ds.c.surface }]}>
        <EquipmentThumb id={pick.id} name={pick.name} size={52} />
      </View>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {pick.name}
        </DsText>
        <Caption tone="muted">{sub}</Caption>
      </View>
      {pick.have ? <Caption color={palateHues[ds.scheme].green}>Have it</Caption> : <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />}
    </PressableScale>
  );
}

/** Today's pairing from the flavour map ("Campari goes with Grapefruit in 38 drinks."), Map opening it there. */
function PairNote() {
  const ds = useDs();
  const router = useRouter();
  const [today] = useState(() => new Date());
  const core = useCoreIngredients().data ?? [];
  const from = pickOfDay(core, today);
  const top = usePairings(from ? [from.id] : [], { limit: 1 }).data?.[0];
  const text = from && top ? pairLine(from.name, top.name, top.together[0] ?? top.drinks) : 'What goes with what, counted from every drink we know.';
  const href = from && top ? `/flavor-map?with=${from.id}` : '/flavor-map';
  return (
    <PressableScale role="link" accessibilityLabel={`${text} Opens the flavour map`} onPress={() => router.push(href as Href)} style={[styles.note, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="leaf.fill" size={20} color={ds.c.ink} />
      <Body style={styles.flex}>{text}</Body>
      <Body color={ds.accentText}>Map</Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  kit: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  pic: { borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
