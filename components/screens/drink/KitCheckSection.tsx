import { StyleSheet, View } from 'react-native';

import { Body, Caption, Surface, useDs } from '@/components/ds';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { space } from '@/constants/tokens';
import { useHomeDrinkKitCheck } from '@/hooks/useKitCheck';
import { equipmentById } from '@/lib/techniques/equipment';
import { ICE_SHAPE_LABEL } from '@/lib/venueKit';

const toolNames = (ids: readonly string[]) => ids.map((id) => equipmentById(id)?.name ?? id).join(', ');

/**
 * "Can you make it?" (Kit and ice, step 11, at home): the drink's glass, ice
 * and tools against My Bar's kit. Home only (Eddie, 26 Oct): a venue's team
 * doesn't need it on every drink, and Library's Ready here covers the venue.
 * What's missing is named, with the nearest you have; a part of your kit with
 * nothing listed isn't checked.
 */
export function KitCheckSection({ itemId, drink }: { itemId: string; drink: string }) {
  const check = useHomeDrinkKitCheck(itemId);
  if (!check || (!check.glass && !check.ice.length && !check.tools)) return null;
  const nearest = check.ice.find((i) => !i.ok && i.nearest);

  return (
    <View style={styles.section}>
      <SectionHeading>Can you make it?</SectionHeading>
      <Surface style={styles.card}>
        {check.glass ? <CheckRow label="Glass" value={check.glass.name} ok={check.glass.ok} line={check.glass.ok ? `Yours: ${check.glass.yours}` : 'Not in your glassware'} /> : null}
        {check.ice.map((i) => (
          <View key={i.kind} style={styles.stack}>
            <CheckRow label="Ice" value={i.name} ok={i.ok && !i.missing.length} line={i.ok ? `Yours: ${i.yours}` : ['Not on your ice list', i.nearest ? `Nearest you have: ${i.nearest}` : null].filter(Boolean).join(' · ')} />
            {i.missing.map((t) => (
              <CheckRow key={t} label={`To make the ${i.yours ?? i.name}`} value={equipmentById(t)?.name ?? t} ok={false} line="Not in your kit" />
            ))}
          </View>
        ))}
        {check.tools ? (
          <View style={styles.stack}>
            <CheckRow label="Tools" value={toolNames(check.tools.needed)} ok={!check.tools.missing.length} line={check.tools.missing.length ? 'Not all in your kit' : 'All yours'} />
            {check.tools.missing.map((t) => (
              <CheckRow key={t} label="Not in your kit" value={equipmentById(t)?.name ?? t} ok={false} line={`For the ${drink}`} />
            ))}
          </View>
        ) : null}
      </Surface>
      <Caption tone="muted">
        {check.ready ? 'Everything is yours.' : `${check.needs}.${nearest ? ` Pour it over your ${nearest.nearest}, or add ${ICE_SHAPE_LABEL[nearest.kind].toLowerCase()} to your ice.` : ''}`}
      </Caption>
    </View>
  );
}

function CheckRow({ label, value, ok, line }: { label: string; value: string; ok: boolean; line: string }) {
  const ds = useDs();
  return (
    <View style={styles.row} role="group" aria-label={`${label}: ${value}. ${line}`}>
      <IconSymbol name={ok ? 'checkmark.circle.fill' : 'exclamationmark.circle'} size={18} color={ok ? STATUS.success : ds.accentText} />
      <View style={styles.flex}>
        <Caption tone="muted">{label}</Caption>
        <Body>{value}</Body>
        <Caption tone={ok ? 'muted' : 'accent'}>{line}</Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  card: { gap: space.md, padding: space.md },
  stack: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
