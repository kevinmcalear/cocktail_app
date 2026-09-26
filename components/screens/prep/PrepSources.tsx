import { StyleSheet, View } from 'react-native';

import { Caption, DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { VenueEvent } from '@/hooks/useEvents';

export type PrepSource = { kind: 'tonight' } | { kind: 'event'; event: VenueEvent };

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-selected={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? ds.c.ink : ds.c.raised }]}
    >
      <Caption color={selected ? ds.c.ground : ds.c.ink}>{label}</Caption>
    </PressableScale>
  );
}

interface PrepSourcesProps {
  events: VenueEvent[];
  source: PrepSource;
  onSource: (s: PrepSource) => void;
  canCreate: boolean;
  onNewEvent: () => void;
}

/** Prep for tonight's menu, or for an upcoming event such as a takeover. */
export function PrepSources({ events, source, onSource, canCreate, onNewEvent }: PrepSourcesProps) {
  return (
    <View role="radiogroup" accessibilityLabel="Prep for" style={styles.row}>
      <Chip label="Tonight" selected={source.kind === 'tonight'} onPress={() => onSource({ kind: 'tonight' })} />
      {events.map((e) => (
        <Chip
          key={e.id}
          label={`${e.name} · ${shortDate(e.starts_at)}`}
          selected={source.kind === 'event' && source.event.id === e.id}
          onPress={() => onSource({ kind: 'event', event: e })}
        />
      ))}
      {canCreate ? <GlassButton accessibilityLabel="New event" icon="plus" label="New event" onPress={onNewEvent} /> : null}
    </View>
  );
}

interface ServesProps {
  serves: number;
  onChange: (n: number) => void;
  basis: string | null;
}

/** How many of each drink to prep for. Every tap is a haptic tick. */
export function ServesControl({ serves, onChange, basis }: ServesProps) {
  const step = serves >= 40 ? 10 : serves >= 10 ? 5 : 1;
  return (
    <View style={styles.serves}>
      <View style={styles.servesRow}>
        <GlassButton accessibilityLabel="Fewer serves" icon="minus" onPress={() => onChange(Math.max(1, serves - step))} />
        <View style={styles.servesValue} accessibilityLiveRegion="polite">
          <DsText variant="title" align="center">
            {serves}
          </DsText>
          <Caption tone="muted" align="center">
            serves of each drink
          </Caption>
        </View>
        <GlassButton accessibilityLabel="More serves" icon="plus" onPress={() => onChange(serves + step)} />
      </View>
      {basis ? (
        <Caption tone="muted" align="center">
          {basis}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  serves: { gap: space.sm },
  servesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  servesValue: { flex: 1, alignItems: 'center' },
});
