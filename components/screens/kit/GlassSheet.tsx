import { useState } from 'react';

import { Field } from '@/components/ds';
import { useUserId } from '@/ctx/AuthContext';
import { useBarGlassware, useSaveBarGlass, type BarGlass, type BarGlassInput } from '@/hooks/useBarGlassware';
import { photoFolder, removeGlassPhoto, uploadGlassPhoto, useGlassPhotoUrl } from '@/hooks/useGlassDrawing';
import { useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { canDrawGlass } from '@/lib/glassPhoto';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { kitCount } from '@/lib/venueKit';
import { variantsOf } from '@/lib/sketch/geometry';
import type { SketchGlass } from '@/lib/sketch/types';

import { useDrawGlass, type DrawnGlass } from './draw/useDrawGlass';
import { GlassWhich, type GlassWhichValue } from './GlassWhich';
import { KitAddSheet, useOpenKey, type KitQuestion } from './KitAddSheet';
import { SourceQuestion, trimmed, type KitSource } from './SourceQuestion';

const FAILED = 'Couldn’t save that. Check your connection and try again.';

export interface GlassSheetProps {
  /** The venue; null at home. */
  barId: string | null;
  /** The venue's page, which glassware hangs off. */
  pageId: string | null;
  /** A glass at home (My Bar): no suppliers; `onSave` saves it. */
  home?: boolean;
  visible: boolean;
  onClose: () => void;
  /** The glass to change; null adds one. */
  glass?: BarGlass | null;
  /** The question it opens on: 0 which glass, 1 where it comes from, 2 how many (changing a glass only). */
  startAt?: 0 | 1 | 2;
  /** Opens on naming your own instead of the catalog search. */
  describe?: boolean;
  /** A glass in the Kit with no real glass yet: opens on the catalog search to match it. */
  match?: boolean;
  /** Opens on Draw my glass for a traced glass: a new photo (Redraw) or the number (Fix the height). */
  draw?: 'photo' | 'size';
  /** Instead of saving to the page: holds it (What next) or saves it elsewhere (My Bar, which the sheet waits for). */
  onSave?: (row: BarGlassInput) => void | Promise<unknown>;
  /** Saved: the glass's id, when it's known (a drawn glass opens its page). */
  onSaved?: (id?: string, drawn?: boolean) => void;
  venueName?: string;
  /** A new glass a drink named ("Small Rocks"): its shape starts the search, its name is what you call it. */
  initial?: { glass: SketchGlass; variant?: string | null; name?: string | null };
  /** Where it was named: "From the Paloma", "2 drinks". */
  from?: string;
}

/** Add a glass (which glass it is, where it comes from), or change one (and how many). */
export function GlassSheet(props: GlassSheetProps) {
  return <GlassSheetBody key={useOpenKey(props.visible)} {...props} />;
}

function GlassSheetBody({ barId, pageId, visible, onClose, glass, startAt = 0, describe, match, draw, onSave, onSaved, venueName, initial, from, home }: GlassSheetProps) {
  const suppliers = useVenueSuppliers(barId).data ?? [];
  const known = useBarGlassware(barId).data;
  const glasses = known ?? [];
  const save = useSaveBarGlass(barId, pageId);
  const [step, setStep] = useState<number>(startAt);
  // An onSave that's waited for: saving, or failed.
  const [own, setOwn] = useState<'saving' | 'failed' | null>(null);
  const [which, setWhich] = useState<GlassWhichValue>(() => ({
    mode: glass && !match ? (glass.model ? 'picked' : 'own') : describe ? 'own' : 'find',
    model: glass?.model ?? null,
    glass: glass?.glass ?? initial?.glass ?? 'coupe',
    variant: glass?.variant ?? initial?.variant ?? null,
    // A real glass's own name isn't the venue's: the list says it under the type.
    name: glass?.name && glass.name !== glass.model?.name ? glass.name : (initial?.name ?? ''),
  }));
  // What it said before: Skip leaves it so.
  const [saved] = useState<KitSource>(() => ({ source: glass?.source ?? null, supplier_id: glass?.supplier_id ?? null }));
  const [src, setSrc] = useState<KitSource>(saved);
  const [count, setCount] = useState(glass?.count ? String(glass.count) : '');
  const { n, ok: countOk } = kitCount(count);
  // Draw my glass keeps its photo under the venue's page, or the person's own folder at home: offered where there's one.
  const userId = useUserId();
  const folder = home ? (userId ? photoFolder({ userId }) : null) : pageId && !onSave ? photoFolder({ pageId }) : null;
  const canDraw = !!folder && canDrawGlass();
  const [drawing, setDrawing] = useState(!!draw);
  const photoUrl = useGlassPhotoUrl(drawing ? glass?.photo_path : null).data;
  // The first of its type is the one its drinks are drawn in; one moved to another type is only its main when that type has none.
  const isMain = (shape: SketchGlass) => (glass?.glass === shape ? glass.is_default : !glasses.some((g) => g.id !== glass?.id && g.glass === shape && g.is_default));

  const finished = (id: string | undefined, drawn: boolean) => {
    onSaved?.(id, drawn);
    onClose();
  };

  // Looks right: keep the photo, then the glass with its outline. A redraw lets go of the old photo once saved.
  const saveDrawn = async (d: DrawnGlass) => {
    setOwn('saving');
    let uploaded: string | null = null;
    try {
      if (d.photo) uploaded = await uploadGlassPhoto(folder!, d.photo.jpeg);
      const photo_path = uploaded ?? glass?.photo_path ?? null;
      const row: BarGlassInput = {
        id: glass?.id,
        glass: d.glass,
        variant: null,
        name: trimmed(d.name),
        maker: home ? null : trimmed(d.maker),
        maker_profile_id: null,
        designer: glass?.model ? null : (glass?.designer ?? null),
        series: glass?.model ? null : (glass?.series ?? null),
        shape_note: glass?.model ? null : (glass?.shape_note ?? null),
        model_id: null,
        is_default: isMain(d.glass),
        outline: d.outline,
        capacity_ml: d.capacity_ml,
        photo_path,
      };
      const id = onSave ? await onSave(row) : await save.mutateAsync(row);
      if (d.photo && glass?.photo_path) void removeGlassPhoto(glass.photo_path);
      finished(typeof id === 'string' ? id : glass?.id, true);
    } catch {
      // Not saved: the photo just kept would point at nothing.
      void removeGlassPhoto(uploaded);
      setOwn('failed');
    }
  };
  const drawQ = useDrawGlass({
    first: draw && glass?.outline ? { start: draw, initial: { glass: glass.glass, name: glass.name ?? '', maker: glass.maker ?? '', outline: glass.outline, capacity_ml: glass.capacity_ml } } : null,
    home: !!home,
    photoUrl,
    onBack: () => (draw ? onClose() : setDrawing(false)),
    onDone: (d) => void saveDrawn(d),
  });
  const startDrawing = () => {
    drawQ.begin({ start: 'photo', initial: { glass: which.glass, name: which.name, maker: '' } });
    setDrawing(true);
  };

  const finish = (source: KitSource, howMany: number | null) => {
    const shapes = variantsOf(which.glass);
    const model = which.mode === 'picked' ? which.model : null;
    // A traced glass that becomes a catalog glass is drawn from the catalog's outline now: its own goes, and its photo.
    const untrace = !!model && !!glass?.outline;
    // A real glass keeps its maker, series and designer on the model; one named by hand keeps what it had.
    const kept = model || glass?.model ? null : glass;
    const row: BarGlassInput = {
      id: glass?.id,
      glass: which.glass,
      variant: shapes.some((s) => s.key === which.variant) ? which.variant : null,
      name: trimmed(which.name),
      maker: kept?.maker ?? null,
      maker_profile_id: kept?.maker_profile_id ?? null,
      designer: kept?.designer ?? null,
      series: kept?.series ?? null,
      shape_note: kept?.shape_note ?? null,
      model_id: model?.id ?? null,
      is_default: isMain(which.glass),
      source: source.source === 'bought' || source.source === 'ours' ? source.source : null,
      supplier_id: source.source === 'bought' ? source.supplier_id : null,
      count: howMany,
      ...(untrace ? { outline: null, capacity_ml: null, photo_path: null } : {}),
    };
    const done = (id?: unknown) => {
      if (untrace) void removeGlassPhoto(glass?.photo_path);
      finished(typeof id === 'string' ? id : glass?.id, false);
    };
    if (onSave) {
      const saving = onSave(row);
      if (!saving) return done();
      setOwn('saving');
      return void saving.then(done, () => setOwn('failed'));
    }
    save.mutate(row, { onSuccess: done });
  };

  const questions: KitQuestion[] = [
    {
      title: 'Which glass is it?',
      intro: which.mode === 'own' ? 'Its shape and what you call it. Drinks are drawn in it.' : 'Find the one you pour into. Its size and drawing come with it.',
      body: <GlassWhich value={which} onChange={setWhich} venueModelIds={glasses.flatMap((g) => (g.model_id ? [g.model_id] : []))} venueName={venueName} shape={initial?.glass ?? (match ? glass?.glass : null)} onDraw={canDraw ? startDrawing : undefined} keepShape={!!glass || !!initial} />,
      next: 'Next',
      canNext: which.mode !== 'find',
    },
    {
      title: 'Where does it come from?',
      body: <SourceQuestion kind="glass" value={src} onChange={setSrc} suppliers={suppliers} home={home} />,
      // Adding a glass ends here; changing one goes on to How many (its page's How many row opens there).
      next: glass ? 'Next' : 'Add the glass',
      // Whether it's the main glass of its type needs the venue's glasses (none to know before the page is checked).
      canNext: !!glass || !!known || !pageId,
      onSkip: glass
        ? () => {
            setSrc(saved);
            setStep(2);
          }
        : () => finish(saved, null),
    },
    ...(glass
      ? [
          {
            title: 'How many?',
            intro: 'If you know.',
            body: <Field label="How many" value={count} onChangeText={setCount} placeholder="24" keyboardType="number-pad" maxLength={4} error={countOk ? undefined : 'A whole number, 1 to 9999.'} />,
            next: 'Save',
            canNext: countOk && (!!known || !pageId),
            onSkip: () => finish(src, glass.count ?? null),
          },
        ]
      : []),
  ];
  const title = trimmed(which.name) ?? GLASS_TYPE_LABEL[which.glass];

  return (
    <KitAddSheet
      visible={visible}
      onClose={onClose}
      label={glass ? `Change ${title}` : 'Add a glass'}
      step={step}
      total={questions.length}
      question={drawing && step === 0 ? drawQ.question : questions[step]}
      onNext={() => (step < questions.length - 1 ? setStep(step + 1) : finish(src, n))}
      saving={save.isPending || own === 'saving'}
      error={save.error || own === 'failed' ? FAILED : null}
      answered={glass ? undefined : { what: (which.mode === 'picked' && which.model?.name) || title, from, onChange: () => setStep(0) }}
    />
  );
}
