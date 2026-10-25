import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { radius, space } from '@/constants/tokens';
import { GLASS_ICE_SHAPES, ICE_KINDS, ICE_SHAPE_LABEL, iceDrawKind, iceName, iceSizes, type IceKind, type IceShape } from '@/lib/venueKit';

import { KitChipGroup } from './KitAddSheet';

/** What an ice looks like, as the sheet holds it. `name` null is the name the sheet gives it. */
export interface IceLooksValue {
  shape: IceShape;
  draw_as: IceKind | null;
  size_mm: number | null;
  length_mm: number | null;
  clear: boolean | null;
  stamped: boolean;
  frozen_inside: string;
  name: string | null;
}

/** The name it saves with: the bar's, else the sheet's. */
export const looksName = (v: IceLooksValue) => (v.name ?? iceName(v)).trim();

/** A typed size that's a whole number of mm the database takes. */
export const mmOk = (n: number | null) => n == null || (Number.isInteger(n) && n >= 5 && n <= 2000);

/**
 * Question 1 of Add ice (Kit and ice, step 4): the nearest shape, then size
 * and clear or cloudy if you know them. Stamped and something frozen inside
 * wait behind More. A block or slab to cut from is picked under the shapes.
 */
export function IceLooks({ value, onChange }: { value: IceLooksValue; onChange: (v: IceLooksValue) => void }) {
  const ds = useDs();
  const sizes = iceSizes(value.shape);
  const mm = sizes ? (sizes.length ? value.length_mm : value.size_mm) : null;
  const [typing, setTyping] = useState(mm != null && !sizes?.mm.includes(mm));
  const [more, setMore] = useState(value.stamped || !!value.frozen_inside);
  const [renaming, setRenaming] = useState(value.name != null || value.shape === 'other');
  const set = (patch: Partial<IceLooksValue>) => onChange({ ...value, ...patch });
  const setMm = (n: number | null) => set(sizes?.length ? { length_mm: n } : { size_mm: n });
  const pickShape = (shape: IceShape) => {
    setTyping(false);
    if (shape === 'other') setRenaming(true);
    onChange({ ...value, shape, draw_as: shape === 'cut' || shape === 'other' ? value.draw_as : null, size_mm: null, length_mm: null });
  };
  const name = iceName(value);

  return (
    <View style={styles.stack}>
      <View role="radiogroup" aria-label="What it looks like" style={styles.tiles}>
        {GLASS_ICE_SHAPES.map((s) => (
          <PressableScale
            key={s}
            role="radio"
            aria-checked={value.shape === s}
            accessibilityLabel={ICE_SHAPE_LABEL[s]}
            onPress={() => pickShape(s)}
            style={[styles.tile, { borderColor: value.shape === s ? ds.c.ink : ds.c.line, backgroundColor: value.shape === s ? ds.c.raised : 'transparent' }]}
          >
            <IceThumb kind={iceDrawKind({ shape: s, draw_as: null }) ?? 'cubes'} size={40} />
            <Caption numberOfLines={2} style={styles.center}>
              {ICE_SHAPE_LABEL[s]}
            </Caption>
          </PressableScale>
        ))}
      </View>
      <KitChipGroup label="Or to cut from">
        {(['block', 'slab'] as const).map((s) => (
          <Chip key={s} label={ICE_SHAPE_LABEL[s]} selected={value.shape === s} onPress={() => pickShape(s)} />
        ))}
      </KitChipGroup>
      {value.shape === 'cut' || value.shape === 'other' ? (
        <KitChipGroup label="Drawn as">
          {ICE_KINDS.map((k) => (
            <Chip key={k} label={ICE_SHAPE_LABEL[k]} selected={value.draw_as === k} onPress={() => set({ draw_as: value.draw_as === k ? null : k })} />
          ))}
        </KitChipGroup>
      ) : null}
      {sizes ? (
        <KitChipGroup label={sizes.length ? 'Length, if you know it' : 'Size, if you know it'}>
          {sizes.mm.map((n) => (
            <Chip key={n} label={`${n} mm`} selected={!typing && mm === n} onPress={() => {
                setTyping(false);
                setMm(mm === n ? null : n);
              }} />
          ))}
          <Chip label="Other" selected={typing} onPress={() => {
              setTyping(!typing);
              setMm(null);
            }} />
        </KitChipGroup>
      ) : null}
      {sizes && typing ? (
        <Field
          label={sizes.length ? 'Length (mm)' : 'Size (mm)'}
          value={mm == null ? '' : String(mm)}
          onChangeText={(t) => setMm(t.trim() ? Number(t.trim()) : null)}
          keyboardType="number-pad"
          maxLength={4}
          error={mmOk(mm) ? undefined : 'A whole number of mm, 5 to 2000.'}
        />
      ) : null}
      <KitChipGroup label="Clear or cloudy">
        {([true, false, null] as const).map((c) => (
          <Chip key={String(c)} label={c ? 'Clear' : c === false ? 'Cloudy' : 'Not sure'} selected={value.clear === c} onPress={() => set({ clear: c })} />
        ))}
      </KitChipGroup>
      {more ? (
        <View style={styles.stack}>
          <KitChipGroup label="Stamped" multi>
            <Chip multi label="Stamped with our mark" selected={value.stamped} onPress={() => set({ stamped: !value.stamped })} />
          </KitChipGroup>
          <Field label="Something frozen inside" value={value.frozen_inside} onChangeText={(frozen_inside) => set({ frozen_inside })} placeholder="A viola, a glass prism" maxLength={60} />
        </View>
      ) : (
        <Button label="More: stamped, something frozen inside" variant="ghost" size="sm" onPress={() => setMore(true)} style={styles.start} />
      )}
      {renaming ? (
        <Field label="Its name" value={value.name ?? name} onChangeText={(t) => set({ name: t })} placeholder={name || 'Prism cube'} maxLength={80} />
      ) : (
        <View style={styles.row}>
          <Body tone="muted" style={styles.flex}>{`We’ll call it ${name}.`}</Body>
          <Button label="Rename" variant="ghost" size="sm" onPress={() => setRenaming(true)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Three across, as the board draws them.
  tile: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.sm, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
  center: { textAlign: 'center' },
});
