import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, GlassVariantPicker, Headline, Surface } from '@/components/ds';
import { GlassModelPicker, GlassThumb } from '@/components/glass/GlassModelPicker';
import { MakerPicker } from '@/components/maker/MakerPicker';
import { space } from '@/constants/tokens';
import { glassFromModel, type BarGlass, type BarGlassInput } from '@/hooks/useBarGlassware';
import { glassModelFacts, type GlassModel } from '@/hooks/useGlassModels';
import { GLASS_TYPE_LABEL, GLASS_TYPES, glassFieldProblem, textOrNull, type GlassFields } from '@/lib/glassware';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { variantsOf } from '@/lib/sketch/geometry';
import type { SketchGlass } from '@/lib/sketch/types';

interface GlassFormProps {
  /** The glass being changed, or null to add one. */
  glass: BarGlass | null;
  saving: boolean;
  deleting?: boolean;
  error?: string | null;
  onSave: (row: BarGlassInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** The venue's real glasses, listed first in the search. */
  venueModelIds?: readonly string[];
  venueName?: string;
  /** Start by describing it ("Not listed? Describe it"), not with the search. */
  describe?: boolean;
}

/**
 * One of the venue's glasses. A new one starts with "Which glass is it?"
 * (a maker's model brings its type, drawing, size, maker and series), or is
 * described by hand: its type and drawing, its name, who makes it
 * (a maker's page when there is one, and the name as the bar gives it),
 * designer, series, what the shape is like, and whether it's the glass of
 * its type the venue's drinks are drawn in.
 */
export function GlassForm({ glass, saving, deleting, error, onSave, onCancel, onDelete, venueModelIds, venueName, describe }: GlassFormProps) {
  const [model, setModel] = useState<GlassModel | null>(glass?.model ?? null);
  const [finding, setFinding] = useState(!glass && !describe);
  const [type, setType] = useState<SketchGlass>(glass?.glass ?? 'coupe');
  const [variant, setVariant] = useState<string | null>(glass?.variant ?? null);
  const [fields, setFields] = useState<GlassFields>({
    name: glass?.name ?? '',
    maker: glass?.maker ?? '',
    designer: glass?.designer ?? '',
    series: glass?.series ?? '',
    shape_note: glass?.shape_note ?? '',
  });
  const [makerPage, setMakerPage] = useState<{ id: string; display_name: string } | null>(
    glass?.maker_profile_id && glass.maker_page ? { id: glass.maker_profile_id, display_name: glass.maker_page.display_name } : null,
  );
  const [picking, setPicking] = useState(false);
  const [isMain, setIsMain] = useState(glass?.is_default ?? true);
  const [tried, setTried] = useState(false);
  const problem = tried ? glassFieldProblem(fields) : null;
  const set = (key: keyof GlassFields) => (text: string) => setFields((f) => ({ ...f, [key]: text }));
  // The drawing tiles only need a glass; the rest of the drink is the default look.
  const inputs = useMemo(() => ({ ...draftSketchInputs({ name: '', lines: [] }), glass: type, variant }), [type, variant]);
  const shapes = variantsOf(type);

  const save = () => {
    setTried(true);
    if (glassFieldProblem(fields)) return;
    // A model brings its maker, series and designer; the venue's own name wins.
    if (model) {
      return onSave({
        ...glassFromModel(model, isMain, textOrNull(fields.name)),
        id: glass?.id,
        variant: shapes.some((s) => s.key === variant) ? variant : null,
        shape_note: textOrNull(fields.shape_note),
      });
    }
    onSave({
      id: glass?.id,
      model_id: null,
      glass: type,
      variant: shapes.some((s) => s.key === variant) ? variant : null,
      name: textOrNull(fields.name),
      maker: textOrNull(fields.maker) ?? makerPage?.display_name ?? null,
      maker_profile_id: makerPage?.id ?? null,
      designer: textOrNull(fields.designer),
      series: textOrNull(fields.series),
      shape_note: textOrNull(fields.shape_note),
      is_default: isMain,
    });
  };

  const pick = (m: GlassModel) => {
    // A name the last model filled in goes with it; one the venue typed stays.
    setFields((f) => (f.name.trim() && f.name !== model?.name ? f : { ...f, name: '' }));
    setModel(m);
    setType(m.glass);
    setVariant(m.variant);
    setFinding(false);
  };

  if (finding) {
    return (
      <View style={styles.form}>
        <View style={styles.stack}>
          <Headline role="heading">Which glass is it?</Headline>
          <Caption tone="muted">Find the one you pour into. Its size and drawing come with it.</Caption>
        </View>
        <GlassModelPicker
          venueModelIds={venueModelIds}
          venueName={venueName}
          initialGlass={glass?.glass ?? null}
          onPick={pick}
          onDescribe={() => setFinding(false)}
        />
        <Button label="Cancel" variant="ghost" onPress={glass ? () => setFinding(false) : onCancel} style={styles.start} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Headline role="heading">{glass ? 'Change this glass' : 'Add a glass'}</Headline>
      {model ? (
        <View style={styles.stack}>
          <Surface style={styles.picked}>
            <GlassThumb glass={model.glass} variant={variant} size={72} />
            <View style={styles.flex}>
              <Body>{model.name}</Body>
              <Caption tone="muted">{glassModelFacts(model)}</Caption>
              {model.maker ? <Caption tone="muted">{`by ${model.maker.display_name}`}</Caption> : null}
            </View>
          </Surface>
          <View style={styles.actions}>
            <Button label="Another glass" variant="secondary" onPress={() => setFinding(true)} />
            <Button label="Not this one" variant="ghost" onPress={() => setModel(null)} />
          </View>
        </View>
      ) : (
        <Button label="Find it in the makers’ catalogs" variant="secondary" onPress={() => setFinding(true)} style={styles.start} />
      )}
      {model ? null : (
        <View style={styles.stack}>
          <Caption tone="muted">Type</Caption>
          <View role="radiogroup" aria-label="Glass type" style={styles.chips}>
            {GLASS_TYPES.map((g) => (
              <Chip
                key={g}
                label={GLASS_TYPE_LABEL[g]}
                selected={g === type}
                onPress={() => {
                  setType(g);
                  setVariant(null);
                }}
              />
            ))}
          </View>
        </View>
      )}
      {shapes.length > 1 ? (
        <View style={styles.stack}>
          <Caption tone="muted">{model ? 'Drawn as: picked from the glass, change it if yours looks different' : 'Which drawing is closest'}</Caption>
          <GlassVariantPicker glass={type} inputs={inputs} seed="bar-glass" value={variant} onChange={setVariant} accessibilityLabel="Glass drawing" />
        </View>
      ) : null}
      <Field
        label="Name"
        value={fields.name}
        onChangeText={set('name')}
        placeholder={model?.name ?? GLASS_TYPE_LABEL[type]}
        maxLength={80}
        error={problem?.field === 'name' ? problem.message : undefined}
      />

      {model ? null : (
        <>
          <View style={styles.stack}>
            <Caption tone="muted">Who makes it</Caption>
            {makerPage && !picking ? (
              <View style={styles.stack}>
                <Body>{`Maker’s page: ${makerPage.display_name}`}</Body>
                <View style={styles.actions}>
                  <Button label="Change" variant="secondary" onPress={() => setPicking(true)} />
                  <Button label="Remove" variant="ghost" onPress={() => setMakerPage(null)} />
                </View>
              </View>
            ) : picking ? (
              <View style={styles.stack}>
                <MakerPicker
                  label="Find its maker’s page"
                  makes="glassware"
                  onPick={(m) => {
                    setMakerPage({ id: m.id, display_name: m.display_name });
                    if (!fields.maker.trim()) setFields((f) => ({ ...f, maker: m.display_name }));
                    setPicking(false);
                  }}
                />
                <Button label="Cancel" variant="ghost" onPress={() => setPicking(false)} style={styles.start} />
              </View>
            ) : (
              <Button label="Find its maker’s page" variant="secondary" onPress={() => setPicking(true)} style={styles.start} />
            )}
            <Field
              label="Maker, as you’d write it"
              value={fields.maker}
              onChangeText={set('maker')}
              placeholder="A glassworks, a potter, an edition"
              maxLength={80}
              hint="Shown when the maker has no page."
              error={problem?.field === 'maker' ? problem.message : undefined}
            />
          </View>
          <Field
            label="Designer"
            value={fields.designer}
            onChangeText={set('designer')}
            maxLength={80}
            error={problem?.field === 'designer' ? problem.message : undefined}
          />
          <Field
            label="Series"
            value={fields.series}
            onChangeText={set('series')}
            maxLength={80}
            error={problem?.field === 'series' ? problem.message : undefined}
          />
          <Field
            label="What the shape is like"
            value={fields.shape_note}
            onChangeText={set('shape_note')}
            placeholder="Tall, narrow V on a short stem"
            minLines={2}
            maxLength={500}
            error={problem?.field === 'shape_note' ? problem.message : undefined}
          />
        </>
      )}
      <View role="group" aria-label="Main glass">
        <Chip multi label={`The venue’s main ${GLASS_TYPE_LABEL[type].toLowerCase()}`} selected={isMain} onPress={() => setIsMain((m) => !m)} />
        <Caption tone="muted">{`Drinks served in a ${GLASS_TYPE_LABEL[type].toLowerCase()} are drawn in this one.`}</Caption>
      </View>

      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}
      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Save glass'} disabled={saving || deleting} onPress={save} />
        <Button label="Cancel" variant="ghost" disabled={saving} onPress={onCancel} />
        {onDelete ? <Button label={deleting ? 'Removing…' : 'Remove glass'} variant="ghost" disabled={saving || deleting} onPress={onDelete} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  stack: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  start: { alignSelf: 'flex-start' },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  flex: { flex: 1, minWidth: 0 },
});
