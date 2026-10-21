import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Segmented, useDs } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { WizardPick } from '@/lib/drinkWizard';
import { ICE_TO, ICE_TO_LABEL, iceKind, isLoose, MAX_LAYERS, MAX_PIECES, singular, type IceLayer, type IceTo } from '@/lib/iceBuild';

// Narrow icons that still take a 44 point tap.
const HIT = { left: 6, right: 6 };
const HEIGHTS = ICE_TO.map((value) => ({ value, label: ICE_TO_LABEL[value] }));

/** − n +, for how many pieces. */
export function CountStepper({ value, onChange, noun }: { value: number; onChange: (n: number) => void; noun: string }) {
  const ds = useDs();
  const step = (by: number) => onChange(Math.min(MAX_PIECES, Math.max(1, value + by)));
  const button = (by: number) => (
    <PressableScale
      role="button"
      accessibilityLabel={`${by < 0 ? 'One fewer' : 'One more'} ${noun}`}
      disabled={by < 0 ? value <= 1 : value >= MAX_PIECES}
      onPress={() => step(by)}
      style={[styles.step, { borderColor: ds.c.lineStrong }]}
    >
      <IconSymbol name={by < 0 ? 'minus' : 'plus'} size={14} color={ds.c.ink} />
    </PressableScale>
  );
  return (
    <View style={styles.stepper}>
      {button(-1)}
      <DsText variant="spec" style={styles.count} aria-live="polite">
        {String(value)}
      </DsText>
      {button(1)}
    </View>
  );
}

/** How high loose ice goes: Half, To the top, Mounded. */
export function HeightPicker({ value, onChange }: { value: IceTo; onChange: (to: IceTo) => void }) {
  return <Segmented options={HEIGHTS} value={value} onChange={onChange} accessibilityLabel="How high it goes" variant="ink" stretch choice />;
}

interface IceLayersProps {
  layers: IceLayer<WizardPick>[];
  onChange: (layers: IceLayer<WizardPick>[]) => void;
  onAdd: () => void;
  /** Where the venue's ice comes from ("Made here · Hoshizaki"), by name. */
  sourceOf?: (name: string) => string | null;
}

/**
 * The ice in the glass, bottom to top (canvas "Ice builds", row 1): each
 * layer's ice, how many pieces or how high loose ice goes, and Add a layer on
 * top. Only cubes are counted (a spear, a large cube are one), and one layer alone needs no count.
 */
export function IceLayers({ layers, onChange, onAdd, sourceOf }: IceLayersProps) {
  const ds = useDs();
  const put = (i: number, patch: Partial<IceLayer<WizardPick>>) => onChange(layers.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  // ponytail: up and down arrows, not the board's drag grip (drag lists are fragile on the web); a grip if bartenders ask.
  const move = (i: number, by: number) => {
    const next = [...layers];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  const several = layers.length > 1;
  return (
    <View style={styles.stack}>
      {several ? <Caption tone="muted">Bottom to top.</Caption> : null}
      <View role="list" aria-label="In the glass, bottom to top" style={[styles.card, { backgroundColor: ds.c.surface }]}>
        {layers.map((l, i) => {
          const kind = iceKind(l.ice.name);
          const loose = isLoose(l.ice.name);
          const sub = l.tin ? 'The shaking ice, dumped in' : sourceOf?.(l.ice.name) ?? null;
          const name = l.tin ? `${l.ice.name}, from the tin` : l.ice.name;
          return (
            <View key={`${i}-${l.ice.id ?? l.ice.name}`} role="listitem" style={[styles.row, i > 0 && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.head}>
                {kind && kind !== 'none' ? <IceThumb kind={kind} size={40} /> : null}
                <View style={styles.flex}>
                  <Body numberOfLines={1}>{name}</Body>
                  {sub ? (
                    <Caption tone="muted" numberOfLines={2}>
                      {sub}
                    </Caption>
                  ) : null}
                </View>
                <View style={styles.icons}>
                  {several ? <Icon name="chevron.up" label={`Move ${l.ice.name} up the list, lower in the glass`} onPress={() => move(i, -1)} disabled={i === 0} /> : null}
                  {several ? <Icon name="chevron.down" label={`Move ${l.ice.name} down the list, higher in the glass`} onPress={() => move(i, 1)} disabled={i === layers.length - 1} /> : null}
                  <Icon name="xmark" label={`Remove ${l.ice.name}`} onPress={() => onChange(layers.filter((_, j) => j !== i))} />
                </View>
              </View>
              {l.tin ? null : loose ? (
                <View>
                  <HeightPicker value={l.to ?? 'rim'} onChange={(to) => put(i, { to })} />
                </View>
              ) : several && (kind === 'cubes' || (l.n ?? 1) > 1) ? (
                <View style={[styles.control, styles.between]}>
                  <Caption tone="muted">How many</Caption>
                  <CountStepper value={l.n ?? 1} noun={singular(l.ice.name)} onChange={(n) => put(i, { n })} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      {layers.length < MAX_LAYERS ? (
        <PressableScale role="button" accessibilityLabel="Add a layer on top" onPress={onAdd} style={[styles.add, { borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="plus" size={16} color={ds.accentText} />
          <Body>Add a layer on top</Body>
        </PressableScale>
      ) : null}
    </View>
  );
}

function Icon({ name, label, onPress, disabled }: { name: 'chevron.up' | 'chevron.down' | 'xmark'; label: string; onPress: () => void; disabled?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={HIT} style={[styles.icon, disabled && styles.off]}>
      <IconSymbol name={name} size={14} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { paddingVertical: space.md, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  control: { paddingLeft: 40 + space.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 22, textAlign: 'center' },
  icons: { flexDirection: 'row' },
  icon: { width: 32, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed' },
});
