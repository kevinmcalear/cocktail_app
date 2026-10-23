import { useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Surface } from '@/components/ds';
import { FIRST_TYPES, MORE_TYPES } from '@/components/glass/GlassModelPicker';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { GlassForm } from '@/components/screens/venue/GlassForm';
import { space } from '@/constants/tokens';
import { useBarGlassware, useDeleteBarGlass, useHeldGlasses, useSaveBarGlass } from '@/hooks/useBarGlassware';
import { useGlassModelSearch, type GlassModel } from '@/hooks/useGlassModels';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { heldNotOnPage } from '@/lib/whatNext';
import type { SketchGlass } from '@/lib/sketch/types';
import { useVenueSetup } from '@/store/useVenueSetup';

import { GlassShelfRows } from './GlassShelfRows';

/** "coupe", "Nick & Nora", "rocks": a shape in a sentence. */
const shapeWord = (g: SketchGlass) => (g === 'nick' ? GLASS_TYPE_LABEL.nick : GLASS_TYPE_LABEL[g].toLowerCase());

/** A catalog glass as a Glassware row (the main one is decided when it's saved). */
const fromModel = (m: GlassModel) => ({ glass: m.glass, variant: m.variant, name: m.name, maker: m.maker?.display_name ?? null, maker_profile_id: m.maker_profile_id, designer: m.designer, series: m.series, shape_note: null, model_id: m.id });

/** Skip and the main button side by side, as the board pins them. */
export function StepFooter({ skip, onSkip, label, onPress, disabled }: { skip: string; onSkip: () => void; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={styles.footer}>
      <Button label={skip} variant="secondary" size="lg" onPress={onSkip} />
      <Button label={label} size="lg" onPress={onPress} disabled={disabled} style={styles.flex} />
    </View>
  );
}

/**
 * Step 1, your glasses: search the makers' catalogs by maker, range or name,
 * or browse a shape ("Every coupe", by maker). A + puts a glass on the
 * shelf the way Venue settings' Glassware saves one (the first of its type
 * is the main one); a check takes it off. Glassware hangs off the venue's
 * page, so before it's checked (no `pageId`) picks are held on the device
 * and go onto the page once it is (useFlushHeldGlasses).
 */
export function GlassesStep({ barId, pageId, name, step, onBack, onNext, onSkip }: { barId: string; pageId: string | null; name: string; step: string; onBack: () => void; onNext: () => void; onSkip: () => void }) {
  const chrome = useSetupChrome();
  const client = useQueryClient();
  const glasses = useBarGlassware(barId).data ?? [];
  const held = useHeldGlasses(barId);
  const holdGlass = useVenueSetup((s) => s.holdGlass);
  const dropGlass = useVenueSetup((s) => s.dropGlass);
  const save = useSaveBarGlass(barId, pageId);
  const remove = useDeleteBarGlass(barId);
  const [term, setTerm] = useState('');
  const search = useDeferredValue(term).trim();
  const [shape, setShape] = useState<SketchGlass | null>(null);
  const [describing, setDescribing] = useState(false);
  const [more, setMore] = useState(false);
  const [maker, setMaker] = useState<string | null>(null);
  // Taps not saved yet: a + shows its check straight away.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState(false);
  const found = useGlassModelSearch(search, null, { enabled: !shape && !describing });
  const every = useGlassModelSearch('', shape, { enabled: !!shape, limit: 100 });

  const onShelf = (m: GlassModel) => pending[m.id] ?? (glasses.some((g) => g.model_id === m.id) || held.some((g) => g.model_id === m.id));
  const toggle = async (m: GlassModel) => {
    if (m.id in pending) return;
    const on = onShelf(m);
    const kept = held.find((g) => g.model_id === m.id);
    if (on && kept) return dropGlass(barId, kept.key);
    if (!pageId) {
      if (!on) holdGlass(barId, { key: m.id, ...fromModel(m), is_default: false });
      return;
    }
    setPending((p) => ({ ...p, [m.id]: !on }));
    setFailed(false);
    try {
      const mine = glasses.find((g) => g.model_id === m.id);
      if (on && mine) await remove.mutateAsync(mine.id);
      else if (!on) {
        const main = !glasses.some((g) => g.glass === m.glass && g.is_default);
        await save.mutateAsync({ ...fromModel(m), is_default: main });
      }
      await client.refetchQueries({ queryKey: ['bar-glassware', barId] });
    } catch {
      setFailed(true);
    } finally {
      setPending(({ [m.id]: _done, ...rest }) => rest);
    }
  };

  // A failed + leaves its error on the shared save: the form starts clean.
  const describe = () => {
    save.reset();
    setDescribing(true);
  };

  const count = glasses.length + heldNotOnPage(held, glasses).length;
  // Described by hand and waiting for the page: listed here so one can come off.
  const own = held.filter((g) => !g.model_id);
  const page = (title: string, back: () => void, footer: ReactNode, body: ReactNode) => (
    <SetupChromeProvider value={{ ...chrome, title, intro: undefined, mark: undefined, eyebrow: null, progress: null, topLabel: step, noBack: false, onBack: back }}>
      <SetupPage footer={footer}>
        {body}
        {pageId ? null : <Caption tone="muted">{`Kept with your setup. They go on ${name}’s page once we’ve checked it’s yours.`}</Caption>}
        {failed ? (
          <Caption tone="accent" role="alert">
            Couldn’t change your shelf. Check your connection and try again.
          </Caption>
        ) : null}
      </SetupPage>
    </SetupChromeProvider>
  );

  if (describing) {
    return page(
      'Which glasses do you pour into?',
      () => setDescribing(false),
      null,
      <Surface style={styles.card}>
        <GlassForm
          glass={null}
          describe
          saving={save.isPending}
          error={save.error ? 'Couldn’t save that. Check your connection and try again.' : null}
          onSave={(row) => {
            if (pageId) return save.mutate(row, { onSuccess: () => setDescribing(false) });
            holdGlass(barId, { ...row, key: `own-${Date.now()}` });
            setDescribing(false);
          }}
          onCancel={() => setDescribing(false)}
        />
      </Surface>
    );
  }

  if (shape) {
    const models = every.data ?? [];
    const makers = [...new Set(models.map((m) => m.maker?.display_name).filter((n): n is string => !!n))];
    const shown = maker ? models.filter((m) => m.maker?.display_name === maker) : models;
    return page(
      `Every ${shapeWord(shape)}`,
      () => setShape(null),
      <StepFooter skip="Not listed? Describe it" onSkip={describe} label="Done" onPress={() => setShape(null)} />,
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View role="radiogroup" aria-label="Maker" style={styles.chips}>
            <Chip label="All makers" selected={!maker} onPress={() => setMaker(null)} />
            {makers.map((n) => (
              <Chip key={n} label={n} selected={maker === n} onPress={() => setMaker(n)} />
            ))}
          </View>
        </ScrollView>
        {every.isLoading ? <Caption tone="muted">Loading…</Caption> : null}
        {every.error ? <Body tone="muted">Couldn’t load the glasses. Check your connection and try again.</Body> : null}
        {!every.isLoading && !every.error && !models.length ? <Body tone="muted">{`No maker lists a ${shapeWord(shape)} yet.`}</Body> : null}
        <GlassShelfRows models={shown} by="maker" onShelf={onShelf} onToggle={(m) => void toggle(m)} />
      </>
    );
  }

  const results = found.data ?? [];
  const looking = search.length >= 2;
  return page(
    'Which glasses do you pour into?',
    onBack,
    <StepFooter skip="Skip" onSkip={onSkip} label={count ? `${count} on your shelf · Next` : 'Next'} onPress={onNext} />,
    <>
      <Field label="Search glasses by maker, range or name" icon="magnifyingglass" value={term} onChangeText={setTerm} placeholder="Maker, range or name" autoCorrect={false} maxLength={80} />
      <View style={styles.stack}>
        <Caption tone="muted">Or browse by shape</Caption>
        <View style={styles.wrap}>
          {(more ? [...FIRST_TYPES, ...MORE_TYPES] : FIRST_TYPES.slice(0, 5)).map((g) => (
            <Button
              key={g}
              label={GLASS_TYPE_LABEL[g]}
              variant="secondary"
              size="sm"
              accessibilityLabel={`Every ${shapeWord(g)}`}
              onPress={() => {
                setMaker(null);
                setShape(g);
              }}
            />
          ))}
          {more ? null : <Button label="More" variant="secondary" size="sm" accessibilityLabel="More shapes" onPress={() => setMore(true)} />}
        </View>
      </View>
      {own.length ? (
        <View role="group" aria-label="Described by you" style={styles.wrap}>
          {own.map((g) => {
            const label = g.name ?? GLASS_TYPE_LABEL[g.glass];
            return <Chip key={g.key} multi selected label={label} accessibilityLabel={`${label} is on your shelf. Remove`} onPress={() => dropGlass(barId, g.key)} />;
          })}
        </View>
      ) : null}
      {looking && results.length ? <GlassShelfRows models={results} by="range" onShelf={onShelf} onToggle={(m) => void toggle(m)} /> : null}
      {looking && !results.length && !found.isFetching ? (
        found.error ? (
          <Body tone="muted">Couldn’t search the glasses. Check your connection and try again.</Body>
        ) : (
          <View style={styles.stack}>
            <Body tone="muted">{`No ${search} glasses in the catalogue yet. Describe yours and it’s yours straight away; we add the range when we can.`}</Body>
            <Button label="Describe it yourself" variant="secondary" onPress={describe} style={styles.start} />
          </View>
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  stack: { gap: space.sm },
  chips: { flexDirection: 'row', gap: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  card: { gap: space.md, padding: space.lg },
  start: { alignSelf: 'flex-start' },
});
