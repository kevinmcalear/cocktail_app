import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field, Headline, Sheet, SheetScrollView } from '@/components/ds';
import { space } from '@/constants/tokens';
import { kitHasTool, toolLabel } from '@/lib/venueKit';

/** Tools ice is made with, offered first (lib/techniques/equipment.ts ids). */
const ICE_TOOLS = ['bandsaw', 'ice-saw', 'ice-tools', 'ice-ball-press', 'ice-stamp', 'block-shaver', 'silicone-moulds', 'ice-cooler', 'mixing-glass'];
/** item_steps.equipment holds at most 12. */
const MAX = 12;

type KitTool = { key: string | null; name: string | null };

/**
 * The tools one step of an ice's recipe needs: the venue's own tools, the ice
 * tools we know, or one typed by name. Each says when the kit hasn't got it.
 * Done hands the list back; the page saves it with the rest.
 */
export function StepToolsSheet({ step, value, kit, onDone, onClose }: { step: number; value: string[]; kit: readonly KitTool[]; onDone: (tools: string[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState(value);
  const [typed, setTyped] = useState('');
  const kitTools = kit.map((r) => r.key ?? r.name ?? '').filter(Boolean);
  const offered = [...new Set([...kitTools, ...ICE_TOOLS, ...value])];
  const full = picked.length >= MAX;
  const toggle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : full ? p : [...p, t]));
  const addTyped = () => {
    const t = typed.trim();
    if (!t || full || picked.some((p) => p.toLowerCase() === t.toLowerCase())) return;
    setPicked((p) => [...p, t]);
    setTyped('');
  };
  const missing = (t: string) => kit.length > 0 && !kitHasTool(kit, t);
  return (
    <Sheet visible onClose={onClose} accessibilityLabel={`Tools for step ${step}`} keyboard style={styles.pad} header={<Headline role="heading">{`Tools for step ${step}`}</Headline>}>
      <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Caption tone="muted">What this step needs. The kit check reads them, so a missing tool shows before anyone starts.</Caption>
        <View role="group" accessibilityLabel="Tools" style={styles.chips}>
          {[...offered, ...picked.filter((t) => !offered.includes(t))].map((t) => (
            <Chip key={t} label={toolLabel(t)} count={missing(t) ? 'not in your kit' : undefined} selected={picked.includes(t)} multi disabled={full && !picked.includes(t)} onPress={() => toggle(t)} />
          ))}
        </View>
        <Field label="Another tool, by name" value={typed} onChangeText={setTyped} onSubmitEditing={addTyped} placeholder="Our big chisel" maxLength={60} returnKeyType="done" />
        {typed.trim() ? <Button label={`Add ${typed.trim()}`} variant="secondary" onPress={addTyped} disabled={full} /> : null}
        {full ? <Caption tone="muted">{`A step names ${MAX} tools at most.`}</Caption> : null}
        <Button label="Done" onPress={() => onDone(picked)} />
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  body: { gap: space.md, paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
