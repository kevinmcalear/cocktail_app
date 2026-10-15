import { StyleSheet, View } from 'react-native';

import { Caption, DateField, DrinkImage, DsText, PressableScale, Segmented, TimeField, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { dayLabel } from '@/lib/collection';
import { nextMondays, type PlanDraft } from '@/lib/menus';
import type { MenuPicture } from '@/types/menus';

/** The pencil lines under the drinks on the little card, as wide as drawn (of 300, before the card is scaled). */
const LINES = [180, 140];

/**
 * The menu being made, as a small guest card: flat and square on a paper
 * panel, never tilted (nm-decided). When it goes on, its name in the display
 * face (faint until it has one), a short rule, the first drinks' pictures (or
 * two empty frames), and pencil lines for the rest.
 */
export function DraftCard({ name, when, pictures }: { name: string | null; when: string | null; pictures: MenuPicture[] }) {
  const ds = useDs();
  const shown = pictures.slice(0, 4);
  return (
    <View style={[styles.panel, { backgroundColor: ds.c.paper }]} aria-hidden>
      {/* Set at twice the size and scaled down, so its type keeps the card's proportions. */}
      <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
        {when ? (
          <Caption color={ds.c.muted} numberOfLines={1} style={styles.eyebrow}>
            {when.toUpperCase()}
          </Caption>
        ) : null}
        <DsText variant="title" align="center" numberOfLines={1} color={name ? ds.c.ink : withAlpha(ds.c.ink, 0.3)} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name ?? 'Your menu'}
        </DsText>
        <View style={[styles.rule, { backgroundColor: ds.c.lineStrong }]} />
        <View style={styles.drinks}>
          {shown.length
            ? shown.map((p) => <DrinkImage key={p.id} thumb sketchDetail="thumb" source={p.imageUrl} generated={p.isSketch} itemId={p.id} accessibilityLabel={p.name} radius={0} style={styles.drink} />)
            : [0, 1].map((i) => <View key={i} style={[styles.frame, { borderColor: withAlpha(ds.c.sketchInk, 0.3) }]} />)}
        </View>
        {LINES.map((w, i) => (
          <View key={i} style={[styles.line, { width: w, backgroundColor: withAlpha(ds.c.sketchInk, 0.22) }]} />
        ))}
      </View>
    </View>
  );
}

/** "2 of 3" with a bar, like the add-drink wizard's. */
export function StepTrack({ at, of }: { at: number; of: number }) {
  const ds = useDs();
  return (
    <View style={styles.track}>
      <View
        role="progressbar"
        accessibilityLabel="Progress"
        aria-valuemin={0}
        aria-valuemax={of}
        aria-valuenow={at + 1}
        style={[styles.bar, { backgroundColor: withAlpha(ds.c.ink, 0.15) }]}
      >
        <View style={[styles.fill, { backgroundColor: ds.c.ink, width: `${((at + 1) / of) * 100}%` }]} />
      </View>
      <Caption tone="muted" style={styles.mono}>{`${at + 1} of ${of}`}</Caption>
    </View>
  );
}

/**
 * A small pick: a name idea (a pill) or a quick day (a rounded box), filled
 * in ink when it's the one.
 */
export function QuickPick({ label, selected, onPress, box, icon }: { label: string; selected: boolean; onPress: () => void; box?: boolean; icon?: 'calendar' }) {
  const ds = useDs();
  const ink = selected ? ds.c.ground : ds.c.ink;
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.pick, box ? styles.box : styles.pill, selected ? { backgroundColor: ds.c.ink } : { borderWidth: 1, borderColor: ds.c.lineStrong }]}
    >
      {icon ? <IconSymbol name={icon} size={16} color={ink} /> : null}
      <DsText variant="body" color={ink} style={[box ? null : type.label, { fontFamily: selected ? fontFamilies.bodySemiBold : fontFamilies.body }]}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/** "Ideas" and the names to tap: the season where the venue is, the month (lib/menus menuNameIdeas). */
export function NameIdeas({ ideas, name, onPick }: { ideas: string[]; name: string; onPick: (idea: string) => void }) {
  if (!ideas.length) return null;
  return (
    <View role="radiogroup" accessibilityLabel="Name ideas" style={styles.wrap}>
      <Caption tone="muted">Ideas</Caption>
      {ideas.map((idea) => (
        <QuickPick key={idea} label={idea} selected={name.trim() === idea} onPress={() => onPick(idea)} />
      ))}
    </View>
  );
}

const GOES_ON = [
  { value: 'run', label: 'From a date' },
  { value: 'night', label: 'One night' },
  { value: 'none', label: 'Not yet' },
] as const;

/**
 * A venue menu's dates: from a day, one night, or not yet, as a segmented
 * control. A day is one of the next two Mondays or another from the calendar.
 * Saved as a plan; Go live puts it on.
 */
export function VenueDatesFields({ value, onChange, now, quick = true }: { value: PlanDraft; onChange: (next: PlanDraft) => void; now: number; quick?: boolean }) {
  const set = (patch: Partial<PlanDraft>) => onChange({ ...value, ...patch });
  const mondays = quick ? nextMondays(now) : [];
  const other = value.date && !mondays.includes(value.date) ? value.date : '';
  const min = new Date(now).toISOString().slice(0, 10);
  return (
    <>
      <Segmented variant="ink" stretch choice onSurface accessibilityLabel="Goes on" options={GOES_ON} value={value.kind} onChange={(kind) => set({ kind })} />
      {value.kind !== 'none' && mondays.length ? (
        <View role="radiogroup" accessibilityLabel={value.kind === 'night' ? 'Night' : 'Starts'} style={styles.wrap}>
          {mondays.map((day) => (
            <QuickPick key={day} box label={dayLabel(day, now)} selected={value.date === day} onPress={() => set({ date: day })} />
          ))}
        </View>
      ) : null}
      {value.kind !== 'none' ? <DateField label={mondays.length ? 'Or another day' : value.kind === 'night' ? 'Night' : 'Starts'} value={other} onChange={(date) => set({ date })} min={min} clearable={!!mondays.length} /> : null}
      {value.kind === 'night' ? <TimeField label="From" value={value.time} onChange={(time) => set({ time })} /> : null}
      <Caption tone="muted">{value.kind === 'none' ? 'Pick the day when it’s ready to go live.' : 'It stays a draft until it goes live. A one-night menu can be shared before then.'}</Caption>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch', height: 184, alignItems: 'center', justifyContent: 'center', borderRadius: radius.card, borderCurve: 'continuous' },
  // 300 square at 0.5: a 150 card on the panel.
  card: { width: 300, height: 300, margin: -75, transform: [{ scale: 0.5 }], borderRadius: radius.card + 6, paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', gap: space.sm, borderCurve: 'continuous' },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 2 },
  rule: { width: 44, height: 2, marginBottom: space.sm },
  drinks: { flexDirection: 'row', gap: space.xs, alignItems: 'flex-end' },
  drink: { width: 60, height: 76 },
  frame: { width: 52, height: 64, borderRadius: radius.control, borderWidth: 2.4, borderStyle: 'dashed', marginHorizontal: space.sm },
  line: { height: 4, marginTop: space.sm - 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  track: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bar: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.monoMedium },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg - 2 },
  pill: { minHeight: 36, borderRadius: radius.pill },
  box: { minHeight: layout.minTapTarget, borderRadius: radius.control + 2, paddingHorizontal: space.lg },
});
