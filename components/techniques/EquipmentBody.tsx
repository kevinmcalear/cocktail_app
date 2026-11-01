import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, EquipmentDrawing, useDs } from '@/components/ds';
import { SettingsRow, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { BuyList, Group, Section, TechniqueRow, ValueRow } from '@/components/techniques/bits';
import { LearnHead } from '@/components/techniques/TechniquePage';
import { radius } from '@/constants/tokens';
import { useKit } from '@/hooks/useKit';
import { techniquesUsing, TIER_LABEL, type Equipment } from '@/lib/techniques';
import { useAppMode } from '@/store/useAppMode';

/** The tool drawn on a card, over its name (Kept-learn, A piece of equipment). */
export function EquipmentArt({ id }: { id: string }) {
  const ds = useDs();
  return (
    <View aria-hidden style={[styles.art, { backgroundColor: ds.c.surface }]}>
      <View style={styles.drawing}>
        <EquipmentDrawing id={id} bare />
      </View>
    </View>
  );
}

/**
 * Everything under a tool's name, as Kept-learn draws it: On my shelf, Used
 * in (opens the techniques in place), Good to know, and Where to buy one.
 * The cost tier stays as a row (not drawn; kept so a buyer sees it).
 */
export function EquipmentFacts({ e }: { e: Equipment }) {
  const { kit, toggle } = useKit();
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const mode = useAppMode((s) => s.known);
  const { needs, helps } = techniquesUsing(e.id);
  const used = needs.length + helps.length;
  const know = [e.note, e.swap ? `Without one: ${e.swap}` : null].filter(Boolean).join(' ');
  // Several shops (home and bar, or a glass and a spoon): the button opens the list; one shop opens its page.
  // Home and bar picks both listed: the mode the app is in picks which (as BuyList does).
  const links = e.buy ?? [];
  const split = links.some((l) => l.audience === 'home') && links.some((l) => l.audience === 'bar');
  const shops = split ? links.filter((l) => !l.audience || l.audience === (mode === 'home' ? 'home' : 'bar')) : links;
  const buy = () => (shops.length === 1 ? void Linking.openURL(shops[0].url) : setBuying((b) => !b));
  return (
    <>
      <Group>
        {[
          <SwitchRow key="shelf" label="On my shelf" value={kit.has(e.id)} onValueChange={() => toggle(e.id)} />,
          used ? <SettingsRow key="used" label="Used in" value={`${used} ${used === 1 ? 'technique' : 'techniques'}`} expanded={open} role="button" onPress={() => setOpen((o) => !o)} /> : null,
          <ValueRow key="cost" label="Costs" value={e.price ?? TIER_LABEL[e.tier]} />,
        ]}
      </Group>
      {open ? (
        <View>
          {[...needs, ...helps].map((t) => (
            <TechniqueRow key={t.id} t={t} kit={kit} />
          ))}
        </View>
      ) : null}
      {know ? (
        <Section title="Good to know">
          <Body tone="muted">{know}</Body>
        </Section>
      ) : null}
      {shops.length ? <Button label="Where to buy one" icon="link" variant="secondary" expanded={shops.length > 1 ? buying : undefined} onPress={buy} /> : null}
      {buying && shops.length > 1 ? <BuyList links={shops} /> : null}
    </>
  );
}

/** A tool beside a technique on wide web (Kept-learn-desk): the same page, in a narrower column. */
export function EquipmentPanel({ e }: { e: Equipment }) {
  return (
    <>
      <LearnHead eyebrow="Equipment" title={e.name} intro={<Body tone="muted">{e.what}</Body>} art={<EquipmentArt id={e.id} />} />
      <EquipmentFacts e={e} />
    </>
  );
}

const styles = StyleSheet.create({
  art: { height: 190, borderRadius: radius.card, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  drawing: { width: 160, height: 160 },
});
