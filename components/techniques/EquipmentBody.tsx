import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, EquipmentDrawing, useDs } from '@/components/ds';
import { preloadEquipmentDrawing } from '@/components/ds/EquipmentDrawingLazy';
import { SettingsRow, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { BuyList, Group, Section, shopsFor, TechniqueRow, ValueRow } from '@/components/techniques/bits';
import { LearnHead } from '@/components/techniques/TechniquePage';
import { radius } from '@/constants/tokens';
import { useKit } from '@/hooks/useKit';
import { techniquesUsing, TIER_LABEL, type Equipment } from '@/lib/techniques';
import { useAppMode } from '@/store/useAppMode';

// A kit page's main picture: start loading the painter with the page's code (web), not at its first render.
if (typeof window !== 'undefined') void preloadEquipmentDrawing();

/** The tool drawn over its name: on a card (Kept-learn, A piece of equipment), `plain` on the ground (A technique). */
export function EquipmentArt({ id, plain }: { id: string; plain?: boolean }) {
  const ds = useDs();
  return (
    <View aria-hidden style={[styles.art, !plain && { backgroundColor: ds.c.surface }]}>
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
  // Several shops (a glass and a spoon): the button opens the list; one shop opens its page.
  const shops = shopsFor(e.buy ?? [], mode);
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
      {open && needs.length ? (
        <Section title="Needed for">
          <View>
            {needs.map((t) => (
              <TechniqueRow key={t.id} t={t} kit={kit} />
            ))}
          </View>
        </Section>
      ) : null}
      {open && helps.length ? (
        <Section title="Helps with">
          <View>
            {helps.map((t) => (
              <TechniqueRow key={t.id} t={t} kit={kit} />
            ))}
          </View>
        </Section>
      ) : null}
      {know ? (
        <Section title="Good to know">
          <Body tone="muted">{know}</Body>
        </Section>
      ) : null}
      {shops.length ? <Button label="Where to buy one" icon="link" variant="secondary" expanded={shops.length > 1 ? buying : undefined} onPress={buy} /> : null}
      {buying && shops.length > 1 ? <BuyList links={e.buy ?? []} /> : null}
      {e.price ? null : <Caption tone="muted">Prices are rough tiers, not quotes. Check current prices before buying.</Caption>}
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
  drawing: { width: 170, height: 170 },
});
