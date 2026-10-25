import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface, useDs } from '@/components/ds';
import { GlassSheet } from '@/components/screens/kit/GlassSheet';
import { IceSheet } from '@/components/screens/kit/IceSheet';
import { ToolSheet } from '@/components/screens/kit/ToolSheet';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarPageId } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkKitCheck } from '@/hooks/useKitCheck';
import { glassNoun, type IceCheck } from '@/lib/kitCheck';
import { equipmentById } from '@/lib/techniques/equipment';
import { ICE_SHAPE_LABEL } from '@/lib/venueKit';

type Adding = { kind: 'glass' } | { kind: 'ice'; ice: IceCheck } | { kind: 'tool'; key: string } | null;

const toolNames = (ids: readonly string[]) => ids.map((id) => equipmentById(id)?.name ?? id).join(', ');

/**
 * "Can Little Rye make it?" (Kit and ice, step 11): the drink's glass, ice
 * and tools against the venue's Kit, an ice it makes followed back through
 * its recipe. What's missing is named, with the nearest the venue has, and
 * Prep can add it with Kit's Add sheet.
 */
export function KitCheckSection({ itemId, barId, drink }: { itemId: string; barId: string; drink: string }) {
  const check = useDrinkKitCheck(itemId, barId);
  const venue = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';
  const canAdd = (useCapabilities(barId).data ?? []).includes('prep');
  const pageId = useBarPageId(barId).data ?? null;
  const [adding, setAdding] = useState<Adding>(null);
  if (!check || (!check.glass && !check.ice.length && !check.tools)) return null;
  const add = (label: string, next: Adding) => (canAdd ? <Button label={label} size="sm" variant="secondary" onPress={() => setAdding(next)} /> : null);
  const from = `From the ${drink}`;
  const nearest = check.ice.find((i) => !i.ok && i.nearest);

  return (
    <View style={styles.section}>
      <SectionHeading>{`Can ${venue} make it?`}</SectionHeading>
      <Surface style={styles.card}>
        {check.glass ? (
          <CheckRow label="Glass" value={check.glass.name} ok={check.glass.ok} line={check.glass.ok ? `Yours: ${check.glass.yours}` : 'Not in your glassware'}>
            {check.glass.ok ? null : add(`Add ${glassNoun(check.glass.glass)}`, { kind: 'glass' })}
          </CheckRow>
        ) : null}
        {check.ice.map((i) => (
          <View key={i.kind} style={styles.stack}>
            <CheckRow label="Ice" value={i.name} ok={i.ok && !i.missing.length} line={i.ok ? `Yours: ${i.yours}` : ['Not on your ice list', i.nearest ? `Nearest you have: ${i.nearest}` : null].filter(Boolean).join(' · ')}>
              {i.ok ? null : add(`Add ${ICE_SHAPE_LABEL[i.kind].toLowerCase()}`, { kind: 'ice', ice: i })}
            </CheckRow>
            {i.missing.map((t) => (
              <CheckRow key={t} label={`To make the ${i.yours ?? i.name}`} value={equipmentById(t)?.name ?? t} ok={false} line="Not in your kit">
                {add('Add to kit', { kind: 'tool', key: t })}
              </CheckRow>
            ))}
          </View>
        ))}
        {check.tools ? (
          <View style={styles.stack}>
            <CheckRow label="Tools" value={toolNames(check.tools.needed)} ok={!check.tools.missing.length} line={check.tools.missing.length ? 'Not all in your kit' : 'All yours'} />
            {check.tools.missing.map((t) => (
              <CheckRow key={t} label="Not in your kit" value={equipmentById(t)?.name ?? t} ok={false} line={`For the ${drink}`}>
                {add('Add to kit', { kind: 'tool', key: t })}
              </CheckRow>
            ))}
          </View>
        ) : null}
      </Surface>
      <Caption tone="muted">
        {check.ready ? 'Everything is yours.' : `${check.needs}.${nearest ? ` Pour it over your ${nearest.nearest}, or add ${ICE_SHAPE_LABEL[nearest.kind].toLowerCase()} to your ice.` : ''}`}
      </Caption>
      <GlassSheet
        barId={barId}
        pageId={pageId}
        visible={adding?.kind === 'glass'}
        initial={check.glass ? { glass: check.glass.glass, name: null } : undefined}
        from={from}
        venueName={venue}
        onClose={() => setAdding(null)}
      />
      <IceSheet
        barId={barId}
        visible={adding?.kind === 'ice'}
        initial={adding?.kind === 'ice' ? { name: adding.ice.name, shape: adding.ice.kind } : undefined}
        startAt={1}
        from={from}
        onClose={() => setAdding(null)}
      />
      <ToolSheet barId={barId} visible={adding?.kind === 'tool'} initialKey={adding?.kind === 'tool' ? adding.key : null} startAt={1} from={from} onClose={() => setAdding(null)} />
    </View>
  );
}

function CheckRow({ label, value, ok, line, children }: { label: string; value: string; ok: boolean; line: string; children?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.row} role="group" aria-label={`${label}: ${value}. ${line}`}>
      <IconSymbol name={ok ? 'checkmark.circle.fill' : 'exclamationmark.circle'} size={18} color={ok ? STATUS.success : ds.accentText} />
      <View style={styles.flex}>
        <Caption tone="muted">{label}</Caption>
        <Body>{value}</Body>
        <Caption tone={ok ? 'muted' : 'accent'}>{line}</Caption>
      </View>
      {children}
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
