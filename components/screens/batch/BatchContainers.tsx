import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, DsText, PressableScale, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useBarKit } from '@/hooks/useBarKit';
import { useMyProfile } from '@/hooks/useMyProfile';
import { CONTAINERS, containerText, keepsLabel, ownContainer, pickContainer, TONIGHT_HOURS, expiresOn, expiresText, USE_BY_HOURS, type AheadPart, type Container } from '@/lib/batchContainers';
import { initials } from '@/lib/makeSteps';
import { siteOrigin } from '@/lib/venueLink';

import { LabelCard, shareLabel, type BatchLabel } from '../make/MakeLabel';
import { BatchRow, Choice } from './BatchParts';

const FRESH = [
  { value: 'ahead', label: 'Made ahead' },
  { value: 'fresh', label: 'Made fresh' },
] as const;

/**
 * Every part made ahead (board made-parts-making): which container each part
 * goes in (the venue's own from its Kit first, else ours, the smallest that
 * holds it) and how long each keeps, both changeable on the sheet. Part 1 is
 * the bottle, so only its use-by is here.
 */
export function useContainers(barId: string | null) {
  const { data: kit = [] } = useBarKit(barId);
  const own = kit.flatMap((k) => {
    const c = k.name ? ownContainer(k.name) : null;
    return c ? [c] : [];
  });
  const [picked, setPicked] = useState<Record<number, Container>>({});
  const [kept, setKept] = useState<Record<number, number | null>>({});
  // One chip a name: the venue's own first, then ours it hasn't named the same.
  const options = [...own, ...CONTAINERS].filter((c, i, all) => all.findIndex((o) => o.name.toLowerCase() === c.name.toLowerCase()) === i);
  return {
    options,
    containerOf: (a: AheadPart) => {
      const c = picked[a.part.n];
      return c ? { count: Math.max(1, Math.ceil(a.totalMl / c.ml)), container: c } : pickContainer(a.totalMl, own, a.whipped);
    },
    pick: (n: number, c: Container) => setPicked((p) => ({ ...p, [n]: c })),
    keepsOf: (n: number, worked: number | null) => (n in kept ? kept[n] : worked),
    setKeeps: (n: number, hours: number | null) => setKept((k) => ({ ...k, [n]: hours })),
  };
}

/** A container's label, to stick on it when it's made: the drink and the part, today, its use-by and how much. */
export function useLabel(itemId: string | null | undefined) {
  const me = useMyProfile().data;
  return (name: string, keeps: number | null, amount: string): BatchLabel | null => {
    if (!itemId) return null;
    const made = new Date();
    return { name, made, useBy: keeps ? expiresOn(keeps, made) : null, by: initials(me?.displayName), amount, storage: null, allergens: '', url: `${siteOrigin()}/cocktail/${itemId}` };
  };
}

/** A part's number in its disc, then its eyebrow: "1 · IN THE BOTTLE · PART 1, THE COFFEE". */
export function PartEyebrow({ n, text, trailing }: { n: number; text: string; trailing?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.eyebrowRow}>
      <View style={[styles.disc, { backgroundColor: ds.accentFill.fill }]} aria-hidden>
        <DsText variant="caption" color={ds.accentFill.text}>
          {String(n)}
        </DsText>
      </View>
      <Caption tone="muted" style={[styles.flex, styles.eyebrow]}>
        {text}
      </Caption>
      {trailing}
    </View>
  );
}

/** Made ahead or made fresh for each serve, for someone who can edit the drink. */
export function FreshChoice({ name, fresh, onChange }: { name: string; fresh: boolean; onChange: (fresh: boolean) => void }) {
  return <Choice label={`How ${name} is made`} options={FRESH} value={fresh ? 'fresh' : 'ahead'} onChange={(v) => onChange(v === 'fresh')} />;
}

/** A value that's also a button: tapped, its choices open under it as chips (the freezer check's pattern). */
function Changeable<T>({ text, label, options, value, onChange, show }: { text: string; label: string; options: readonly T[]; value: T | null; onChange: (v: T) => void; show: (v: T) => string }) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.changeable}>
      <PressableScale role="button" aria-expanded={open} accessibilityLabel={`${label}: ${text}, change`} onPress={() => setOpen((o) => !o)} style={[styles.pill, { backgroundColor: ds.c.raised }]}>
        <Caption style={styles.mono}>{text}</Caption>
        <IconSymbol name={open ? 'chevron.down' : 'chevron.right'} size={14} color={ds.c.muted} />
      </PressableScale>
      {open ? (
        <View role="radiogroup" accessibilityLabel={label} style={styles.choices}>
          {options.map((o) => (
            <Chip key={show(o)} label={show(o)} selected={value !== null && show(o) === show(value)} onPress={() => (onChange(o), setOpen(false))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A part's use-by, changeable: close tonight, 1 day, ... 4 weeks. */
export function UseBy({ hours, onChange }: { hours: number | null; onChange: (h: number) => void }) {
  // A shelf life that reads as one of ours ("1 day" for 30 hours) takes its place, so no two chips say the same.
  const choices = hours ? [...USE_BY_HOURS.filter((h) => keepsLabel(h) !== keepsLabel(hours)), hours].sort((a, b) => a - b) : USE_BY_HOURS;
  return <Changeable text={expiresText(hours, new Date()) ?? 'no use-by'} label="Use by" options={choices} value={hours} onChange={onChange} show={keepsLabel} />;
}

/** The label for a container while it's made, with print (web) or share (phone). */
export function LabelBlock({ label }: { label: BatchLabel | null }) {
  if (!label) return null;
  return (
    <View style={styles.label}>
      <LabelCard label={label} />
      <TextLink label={Platform.OS === 'web' ? 'Print label ›' : 'Share label ›'} onPress={() => void shareLabel(label)} />
    </View>
  );
}

/**
 * A later part made ahead, in its own container (board made-parts-making,
 * "Batch, every part made ahead"): its lines scaled to the serves, how it's
 * made, the container as a button and its use-by. Making it, each line is a
 * tick and the label follows.
 */
export function AheadBlock({ a, boxes, keeps, notes, ticked, onTick, labelFor, onFresh }: {
  a: AheadPart;
  boxes: ReturnType<typeof useContainers>;
  keeps: number | null;
  notes: ReadonlyMap<string, string | null>;
  ticked: string[] | null;
  onTick: (key: string) => void;
  /** Its label, given what's in it ("360 ml in 1 × 500 ml deli container"). */
  labelFor: (amount: string) => BatchLabel | null;
  onFresh?: (fresh: boolean) => void;
}) {
  const { part } = a;
  const container = boxes.containerOf(a);
  return (
    <View role="group" aria-label={`Part ${part.n}, ${part.name}, made ahead in its own container`}>
      <PartEyebrow n={part.n} text={`IN ITS OWN CONTAINER · PART ${part.n}, ${part.name.toUpperCase()}`} />
      {onFresh ? <FreshChoice name={part.name} fresh={false} onChange={onFresh} /> : null}
      {a.rows.map((l) => (
        <BatchRow key={l.key} ingredient={l.ingredient} amount={l.amount} sub={l.sub} note={notes.get(l.key) ?? null} checked={ticked?.includes(l.key)} onToggle={ticked ? () => onTick(l.key) : undefined} />
      ))}
      {part.how ? <Body tone="muted" style={styles.how}>{`${part.how}${keeps && keeps <= TONIGHT_HOURS ? ', then keep it cold' : ''}.`}</Body> : null}
      <View style={styles.foot}>
        <Changeable
          text={containerText(container.count, container.container)}
          label="Container"
          options={boxes.options}
          value={container.container}
          onChange={(c) => boxes.pick(part.n, c)}
          show={(c) => c.name}
        />
        <UseBy hours={keeps} onChange={(h) => boxes.setKeeps(part.n, h)} />
      </View>
      {ticked ? <LabelBlock label={labelFor(`${a.total} in ${containerText(container.count, container.container)}`)} /> : null}
    </View>
  );
}

/** The bottle's total, strength and use-by as chips (board drink-sheet-batch-venue). `trailing`: a use-by that can be changed; `spoken` reads them as one. */
export function BottleChips({ chips, spoken, trailing }: { chips: (string | null)[]; spoken?: string; trailing?: ReactNode }) {
  const ds = useDs();
  return (
    <View accessible={!!spoken} accessibilityLabel={spoken} style={styles.chips}>
      {chips.filter((c): c is string => !!c).map((c) => (
        <Caption key={c} style={[styles.chip, { backgroundColor: ds.c.raised }]}>
          {c}
        </Caption>
      ))}
      {trailing}
    </View>
  );
}

/** The numbered list at the station, one step a line, for a busy rail. */
export function InOrder({ steps }: { steps: readonly string[] }) {
  const ds = useDs();
  return (
    <View role="list" aria-label="In order" style={styles.order}>
      <Caption tone="muted" style={styles.eyebrow}>
        IN ORDER
      </Caption>
      {steps.map((s, i) => (
        <View key={i} role="listitem" style={[styles.step, { borderBottomColor: ds.c.line }]}>
          <Caption color={ds.accentText} style={[styles.mono, styles.stepN]}>
            {String(i + 1)}
          </Caption>
          <Body style={styles.flex}>{s}</Body>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { letterSpacing: 1.2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.xs },
  disc: { width: 22, height: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fontFamilies.mono },
  how: { paddingTop: space.sm },
  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.sm, paddingTop: space.sm },
  changeable: { gap: space.sm, maxWidth: '100%' },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, minHeight: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.pill },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  chip: { fontFamily: fontFamilies.mono, paddingHorizontal: space.sm + 2, paddingVertical: space.xs, borderRadius: radius.pill, overflow: 'hidden' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  label: { gap: space.sm, paddingTop: space.md },
  order: { gap: 0 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  stepN: { width: 20, paddingTop: 2 },
});
