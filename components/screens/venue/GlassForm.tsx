import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field, GlassVariantPicker, Headline } from '@/components/ds';
import { GlassModelCard } from '@/components/glass/GlassModelCard';
import { GlassModelPicker } from '@/components/glass/GlassModelPicker';
import { MakerField, type MakerPage } from '@/components/maker/MakerField';
import { space } from '@/constants/tokens';
import type { BarGlass, BarGlassInput } from '@/hooks/useBarGlassware';
import { useGlassModelSearch, type GlassModel } from '@/hooks/useGlassModels';
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
  /** A new glass described by hand from the start ("Not listed? Describe it"). */
  describe?: boolean;
}

/**
 * One of the venue's glasses. A new one starts with "Which glass is it?"
 * (a maker's model brings its type, drawing, size, maker, designer and
 * series), or is described by hand: its type and drawing, its name, who
 * makes it (the name as the bar gives it, linked to the maker's page when
 * there is one), designer, series, what the shape is like, and whether it's
 * the glass of its type the venue's drinks are drawn in. A glass described
 * by hand whose maker lists glasses opens on them: "Is it one of these?"
 */
export function GlassForm({ glass, saving, deleting, error, onSave, onCancel, onDelete, venueModelIds, venueName, describe }: GlassFormProps) {
  const [model, setModel] = useState<GlassModel | null>(glass?.model ?? null);
  // A glass the bar described by hand, as saved: does its maker list glasses?
  const handMaker = glass && !glass.model ? (glass.maker_page?.display_name ?? glass.maker ?? '').trim() : '';
  const makersGlasses = useGlassModelSearch(handMaker, null, { enabled: handMaker.length >= 2 });
  // Only the maker's own: the search also finds other makers' glasses a letter off or naming the word.
  const own = makersGlasses.data?.filter((m) =>
    glass?.maker_profile_id ? m.maker_profile_id === glass.maker_profile_id : m.maker?.display_name.toLowerCase() === handMaker.toLowerCase(),
  );
  const [choseFinding, setFinding] = useState<boolean | null>(null);
  // Until the bar chooses, a new glass starts on the search, and a described one when its maker lists glasses.
  const finding = choseFinding ?? (glass ? handMaker.length >= 2 && (own ? own.length > 0 : !makersGlasses.isError) : !describe);
  const [type, setType] = useState<SketchGlass>(glass?.glass ?? 'coupe');
  const [variant, setVariant] = useState<string | null>(glass?.variant ?? null);
  const [fields, setFields] = useState<GlassFields>({
    name: glass?.name ?? '',
    maker: glass?.maker ?? '',
    designer: glass?.designer ?? '',
    series: glass?.series ?? '',
    shape_note: glass?.shape_note ?? '',
  });
  const [makerPage, setMakerPage] = useState<MakerPage | null>(
    glass?.maker_profile_id && glass.maker_page ? { id: glass.maker_profile_id, display_name: glass.maker_page.display_name } : null,
  );
  // Described with a maker, as the form says now: the search starts there.
  const typedMaker = (makerPage?.display_name ?? fields.maker).trim();
  const matching = !model && typedMaker.length >= 2;
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
    // A model keeps its maker, series and designer (useBarGlassware reads them from it); the venue's own name wins.
    if (model) {
      return onSave({
        id: glass?.id,
        glass: model.glass,
        variant: shapes.some((s) => s.key === variant) ? variant : null,
        name: textOrNull(fields.name) ?? model.name,
        maker: null,
        maker_profile_id: null,
        designer: null,
        series: null,
        shape_note: textOrNull(fields.shape_note),
        model_id: model.id,
        is_default: isMain,
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
          <Headline role="heading">{matching ? 'Is it one of these?' : 'Which glass is it?'}</Headline>
          <Caption tone="muted">
            {matching
              ? `Your ${fields.name.trim() || GLASS_TYPE_LABEL[type]} by ${typedMaker}. Pick it and its size, designer and series come with it.`
              : 'Find the one you pour into. Its size and drawing come with it.'}
          </Caption>
        </View>
        <GlassModelPicker
          venueModelIds={venueModelIds}
          venueName={venueName}
          initialGlass={matching ? null : (glass?.glass ?? null)}
          initialTerm={matching ? typedMaker : ''}
          preferGlass={matching ? type : null}
          onPick={pick}
          onDescribe={() => setFinding(false)}
          describeLabel={matching ? 'Keep it as I described it' : undefined}
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
          <GlassModelCard model={model} variant={variant} />
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
          <MakerField
            label="Who makes it"
            value={fields.maker}
            page={makerPage}
            makes="glassware"
            placeholder="A glassworks, a potter, an edition"
            error={problem?.field === 'maker' ? problem.message : undefined}
            onChange={(maker, page) => {
              setFields((f) => ({ ...f, maker }));
              setMakerPage(page);
            }}
          />
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
});
