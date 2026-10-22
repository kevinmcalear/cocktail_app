import { useDeferredValue, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, PressableScale, Surface, useDs } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { SetupHead } from '@/components/screens/onboarding/SetupParts';
import { GlassForm } from '@/components/screens/venue/GlassForm';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { glassFromModel, useBarGlassware, useBarPageId, useDeleteBarGlass, useSaveBarGlass } from '@/hooks/useBarGlassware';
import { glassModelMaterial, glassModelSize, useGlassModelSearch, type GlassModel } from '@/hooks/useGlassModels';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import type { SketchGlass } from '@/lib/sketch/types';
import { groupGlasses } from '@/lib/whatNext';

import { StepChrome } from './WhatNextParts';

// The shapes a bar mostly looks for first; the rest wait behind More.
const FIRST_SHAPES: SketchGlass[] = ['coupe', 'nick', 'martini', 'rocks', 'highball'];
const MORE_SHAPES: SketchGlass[] = ['collins', 'flute', 'fizz', 'spritz', 'snifter', 'julep', 'tiki', 'mug'];
// The search's most. ponytail: the maker chips come from these, so a shape with more
// than this misses the makers late in the alphabet; a makers-per-shape read is the upgrade.
const SHAPE_LIMIT = 100;

const every = (g: SketchGlass) => `Every ${g === 'nick' ? GLASS_TYPE_LABEL[g] : GLASS_TYPE_LABEL[g].toLowerCase()}`;

/** A maker's glass with a + to put it on the shelf, or a check to take it off. */
function ShelfRow({ model, sub, on, first, busy, onToggle }: { model: GlassModel; sub: string; on: boolean; first: boolean; busy: boolean; onToggle: () => void }) {
  const ds = useDs();
  const size = glassModelSize(model);
  return (
    <View role="listitem" style={[styles.row, first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <GlassThumb glass={model.glass} variant={model.variant} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{model.name}</Body>
        <Caption tone="muted" numberOfLines={1}>
          {sub}
        </Caption>
      </View>
      {size ? <Caption tone="muted">{size}</Caption> : null}
      <PressableScale
        role="button"
        accessibilityLabel={on ? `${model.name} is on your shelf. Remove` : `Add ${model.name}`}
        aria-disabled={busy}
        disabled={busy}
        onPress={onToggle}
        style={[styles.toggle, on ? { backgroundColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong, borderWidth: 1 }]}
      >
        <IconSymbol name={on ? 'checkmark' : 'plus'} size={18} color={on ? ds.accentFill.text : ds.c.ink} />
      </PressableScale>
    </View>
  );
}

/**
 * "Which glasses do you pour into?" (What next, step 1): search a maker or a
 * range, or browse a shape and every glass of it, maker by maker. Each tap
 * puts a real glass on the venue's glassware (Venue settings › Your
 * glassware), the first of its type as the one its drinks are drawn in.
 */
export function GlassesStep({ barId, venueName, onNext, onSkip, onBack }: { barId: string; venueName: string; onNext: () => void; onSkip: () => void; onBack: () => void }) {
  const ds = useDs();
  const [view, setView] = useState<'search' | 'describe' | SketchGlass>('search');
  const [term, setTerm] = useState('');
  const [maker, setMaker] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const shape = view === 'search' || view === 'describe' ? null : view;
  const search = useDeferredValue(shape ? (maker ?? '') : term);
  const { data: pageId, isLoading: pageLoading, error: pageError } = useBarPageId(barId);
  const { data: glasses = [] } = useBarGlassware(barId);
  const found = useGlassModelSearch(search, shape, { enabled: view !== 'describe', limit: shape ? SHAPE_LIMIT : undefined });
  const all = useGlassModelSearch('', shape, { enabled: !!shape && !!maker, limit: SHAPE_LIMIT });
  const save = useSaveBarGlass(barId, pageId);
  const remove = useDeleteBarGlass(barId);
  // One change at a time: the shelf (and which glass is main) is read from the list, which refreshes after each.
  const busy = save.isPending || remove.isPending;
  const shelf = new Map(glasses.flatMap((g) => (g.model_id ? [[g.model_id, g.id] as const] : [])));
  const toggle = (m: GlassModel) => {
    const had = shelf.get(m.id);
    if (had) remove.mutate(had);
    else save.mutate(glassFromModel(m, !glasses.some((g) => g.glass === m.glass && g.is_default)));
  };
  // A maker's name is searched like any words, so keep only that maker's glasses.
  const models = (found.data ?? []).filter((m) => !shape || !maker || m.maker?.display_name === maker);
  const makers = [...new Set((maker ? all.data : models)?.map((m) => m.maker?.display_name).filter((n): n is string => !!n) ?? [])];
  const failure = pageError
    ? 'Couldn’t load your glasses. Check your connection and try again.'
    : save.error || remove.error
      ? 'Couldn’t change your shelf. Check your connection and try again.'
      : null;
  const back = () => {
    setMaker(null);
    setView('search');
  };

  if (!pageLoading && !pageId && !pageError) {
    return (
      <StepChrome title="Which glasses do you pour into?" step="glasses" onBack={onBack}>
        <SetupPage footer={<SetupFooter label="Next" onPress={onSkip} />}>
          <Body tone="muted">{`Glasses sit on ${venueName}’s public page, so they wait until it’s checked. Prove it’s yours from Venue settings, then pick them there.`}</Body>
        </SetupPage>
      </StepChrome>
    );
  }

  if (view === 'describe') {
    return (
      <StepChrome title="Describe your glass" step="glasses" onBack={back}>
        <SetupPage>
          <GlassForm
            glass={null}
            describe
            saving={save.isPending}
            error={failure}
            venueName={venueName}
            onSave={(row) => save.mutate(row, { onSuccess: back })}
            onCancel={back}
          />
        </SetupPage>
      </StepChrome>
    );
  }

  const list = (by: 'range' | 'maker') =>
    groupGlasses(models, by).map((group) => (
      <View key={group.key} style={styles.group}>
        <SetupHead>{by === 'range' ? `${group.title} · ${group.models.length}` : group.title}</SetupHead>
        <View role="list" style={[styles.list, { backgroundColor: ds.c.surface }]}>
          {group.models.map((m, i) => (
            <ShelfRow
              key={m.id}
              model={m}
              first={i === 0}
              on={shelf.has(m.id)}
              busy={busy}
              sub={by === 'range' ? [GLASS_TYPE_LABEL[m.glass], glassModelMaterial(m)?.toLowerCase()].filter(Boolean).join(' · ') : (m.series ?? GLASS_TYPE_LABEL[m.glass])}
              onToggle={() => toggle(m)}
            />
          ))}
        </View>
      </View>
    ));
  const error = failure ? <Caption tone="accent" role="alert">{failure}</Caption> : null;

  if (shape) {
    return (
      <StepChrome title={every(shape)} step="glasses" onBack={back}>
        <SetupPage footer={<SetupFooter label="Done" onPress={back} />}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View role="radiogroup" aria-label="Maker" style={styles.chips}>
              <Chip label="All makers" selected={!maker} onPress={() => setMaker(null)} />
              {makers.map((n) => (
                <Chip key={n} label={n} selected={n === maker} onPress={() => setMaker(n)} />
              ))}
            </View>
          </ScrollView>
          {error}
          {list('maker')}
          {found.isFetching && !models.length ? <Caption tone="muted">Loading…</Caption> : null}
          {!maker && models.length >= SHAPE_LIMIT ? <Caption tone="muted">{`The first ${SHAPE_LIMIT}. Search a maker or a range to find the rest.`}</Caption> : null}
          <Button label="Not listed? Describe it" variant="ghost" onPress={() => setView('describe')} style={styles.start} />
        </SetupPage>
      </StepChrome>
    );
  }

  const looking = search.trim().length >= 2;
  const onShelf = glasses.length;
  return (
    <StepChrome title="Which glasses do you pour into?" step="glasses" onBack={onBack}>
      <SetupPage footer={<SetupFooter label={onShelf ? `${onShelf} on your shelf · Next` : 'Next'} onPress={onNext} skipLabel="Skip" onSkip={onSkip} />}>
        <Field label="Search glasses" hideLabel icon="magnifyingglass" value={term} onChangeText={setTerm} placeholder="Search glasses by maker, range or name" autoCorrect={false} maxLength={80} />
        <Caption tone="muted">Or browse by shape</Caption>
        <View role="group" aria-label="Browse by shape" style={[styles.chips, styles.wrap]}>
          {(more ? [...FIRST_SHAPES, ...MORE_SHAPES] : FIRST_SHAPES).map((g) => (
            <Chip key={g} label={GLASS_TYPE_LABEL[g]} selected={false} onPress={() => setView(g)} accessibilityLabel={every(g)} />
          ))}
          {more ? null : <Chip label="More" selected={false} onPress={() => setMore(true)} />}
        </View>
        {error}
        {looking ? list('range') : null}
        {looking && !found.isFetching && !models.length ? (
          <Surface style={styles.none}>
            <Body>{found.error ? 'Couldn’t search the glasses. Check your connection and try again.' : `No ${search.trim()} glasses in the catalogue yet.`}</Body>
            <Caption tone="muted">Describe yours and it’s yours straight away; we add the range when we can.</Caption>
            <Button label="Describe it yourself" variant="secondary" onPress={() => setView('describe')} style={styles.start} />
          </Surface>
        ) : null}
      </SetupPage>
    </StepChrome>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.xs },
  wrap: { flexWrap: 'wrap' },
  group: { gap: space.sm },
  list: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  toggle: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  none: { gap: space.sm, padding: space.lg },
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
});
