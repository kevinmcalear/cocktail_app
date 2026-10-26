import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, Segmented, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, partyHues, radius, space } from '@/constants/tokens';
import type { RunParty } from '@/lib/runSheet';

export type Step = 'serves' | 'specs' | 'who' | 'sheet';

export const STEPS: { value: Step; label: string; next: string }[] = [
  { value: 'serves', label: '1 How many', next: 'Next: specs' },
  { value: 'specs', label: '2 Specs', next: 'Next: who brings what' },
  { value: 'who', label: '3 Who', next: 'Next: the sheet' },
  { value: 'sheet', label: '4 Sheet', next: '' },
];

/** The four steps (three on desktop, where the sheet is always beside them). */
export function StepNav({ step, onChange, desktop }: { step: Step; onChange: (s: Step) => void; desktop?: boolean }) {
  const options = desktop ? STEPS.filter((s) => s.value !== 'sheet').map((s) => (s.value === 'who' ? { ...s, label: '3 Who brings what' } : s)) : STEPS;
  return <Segmented options={options} value={step} onChange={onChange} accessibilityLabel="Run sheet steps" variant="ink" stretch={!desktop} />;
}

export interface PartyLook {
  /** null: the menu's own bar, us. */
  id: string | null;
  name: string;
  /** The chip's short name: "Caretaker's", "Mill & Ash". */
  short: string;
  /** In our words: "Our bar" and "Coming to us", or "Their bar" and "Us" when we visit them; "Brand". */
  role: string;
  colour: string;
}

/** Each party's name and dot: us in the accent, the others from partyHues in their order. */
export function usePartyLooks(hostName: string, parties: RunParty[]): PartyLook[] {
  const ds = useDs();
  // "Caretaker's Cottage" is "Caretaker's" on a chip, "Mill & Ash Gin" is "Mill & Ash".
  const short = (name: string) => name.replace(/\s+(Gin|Scotch|Rum|Vodka|Whisky|Whiskey|Tequila|Spirits|Distillery|Bar|Cottage|Co\.?)$/i, '') || name;
  const atTheirs = parties.some((p) => p.kind === 'guest' && p.isVenue);
  return [
    { id: null, name: hostName, short: short(hostName), role: atTheirs ? 'Us' : 'Our bar', colour: ds.accentText },
    ...[...parties]
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'guest' ? -1 : 1))
      .map((p, i) => ({ id: p.id, name: p.name, short: short(p.name), role: p.kind === 'brand' ? 'Brand' : atTheirs ? 'Their bar' : 'Coming to us', colour: partyHues[i % partyHues.length] })),
  ];
}

export function Dot({ colour, size = 8 }: { colour: string; size?: number }) {
  return <View aria-hidden style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colour }} />;
}

/** Who brings one thing: a dot and a name, tap to change. */
export function OwnerChip({ look, need, onPress }: { look: PartyLook; need: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`${need}: ${look.name} brings it. Change`}
      onPress={onPress}
      style={[styles.chip, { borderColor: look.colour }]}
    >
      <Dot colour={look.colour} />
      <Caption numberOfLines={1} style={{ color: ds.c.ink, maxWidth: 120 }}>
        {look.short}
      </Caption>
    </PressableScale>
  );
}

/** The menu page's way in, for people who can edit the menu (board 0). */
export function RunSheetLink({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel="Run sheet: serves, swaps, who brings what, PDF"
      onPress={() => router.push(`/menus/${menuId}/run-sheet` as Href)}
      style={[styles.link, { backgroundColor: ds.c.surface, borderColor: ds.accentText }]}
    >
      <View style={[styles.linkIcon, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="doc.text" size={22} color={ds.accentText} />
      </View>
      <View style={{ flex: 1 }}>
        <Body style={styles.strong}>Run sheet</Body>
        <Caption tone="muted">Serves, swaps, who brings what, PDF</Caption>
      </View>
      <IconSymbol name="chevron.right" size={18} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: 32, paddingHorizontal: space.sm + 2, borderRadius: radius.pill, borderWidth: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderCurve: 'continuous', marginBottom: space.lg, minHeight: layout.minTapTarget },
  linkIcon: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
