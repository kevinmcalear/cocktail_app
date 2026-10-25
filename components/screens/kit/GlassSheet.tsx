import { useState } from 'react';

import { Field } from '@/components/ds';
import { useBarGlassware, useSaveBarGlass, type BarGlass, type BarGlassInput } from '@/hooks/useBarGlassware';
import { useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { variantsOf } from '@/lib/sketch/geometry';

import { GlassWhich, type GlassWhichValue } from './GlassWhich';
import { KitAddSheet, type KitQuestion } from './KitAddSheet';
import { SourceQuestion, trimmed, type KitSource } from './SourceQuestion';

const FAILED = 'Couldn’t save that. Check your connection and try again.';

export interface GlassSheetProps {
  barId: string;
  /** The venue's page, which glassware hangs off. */
  pageId: string | null;
  visible: boolean;
  onClose: () => void;
  /** The glass to change; null adds one. */
  glass?: BarGlass | null;
  /** The question it opens on: 0 which glass, 1 where it comes from, 2 how many. */
  startAt?: 0 | 1 | 2;
  /** Opens on naming your own instead of the catalog search. */
  describe?: boolean;
  /** Instead of saving to the page (What next holds glasses until the page is checked). */
  onSave?: (row: BarGlassInput) => void;
  onSaved?: () => void;
  venueName?: string;
}

/** Add a glass, or change one: which glass it is, where it comes from, how many. */
export function GlassSheet(props: GlassSheetProps) {
  return props.visible ? <GlassSheetBody key={props.glass?.id ?? 'new'} {...props} /> : null;
}

function GlassSheetBody({ barId, pageId, visible, onClose, glass, startAt = 0, describe, onSave, onSaved, venueName }: GlassSheetProps) {
  const suppliers = useVenueSuppliers(barId).data ?? [];
  const glasses = useBarGlassware(barId).data ?? [];
  const save = useSaveBarGlass(barId, pageId);
  const [step, setStep] = useState<number>(startAt);
  const [which, setWhich] = useState<GlassWhichValue>(() => ({
    mode: glass ? (glass.model ? 'picked' : 'own') : describe ? 'own' : 'find',
    model: glass?.model ?? null,
    glass: glass?.glass ?? 'coupe',
    variant: glass?.variant ?? null,
    // A real glass's own name isn't the venue's: the list says it under the type.
    name: glass?.name && glass.name !== glass.model?.name ? glass.name : '',
  }));
  const [src, setSrc] = useState<KitSource>({ source: glass?.source ?? null, supplier_id: glass?.supplier_id ?? null });
  const [count, setCount] = useState(glass?.count ? String(glass.count) : '');
  const n = count.trim() ? Number(count.trim()) : null;
  const countOk = n == null || (Number.isInteger(n) && n >= 1 && n <= 9999);

  const finish = (source: KitSource, howMany: number | null) => {
    const shapes = variantsOf(which.glass);
    const model = which.mode === 'picked' ? which.model : null;
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
      // The first of its type is the one its drinks are drawn in.
      is_default: glass ? glass.is_default : !glasses.some((g) => g.glass === which.glass && g.is_default),
      source: source.source === 'bought' || source.source === 'ours' ? source.source : null,
      supplier_id: source.source === 'bought' ? source.supplier_id : null,
      count: howMany,
    };
    const done = () => {
      onSaved?.();
      onClose();
    };
    if (onSave) {
      onSave(row);
      return done();
    }
    save.mutate(row, { onSuccess: done });
  };

  const questions: KitQuestion[] = [
    {
      title: 'Which glass is it?',
      intro: which.mode === 'own' ? 'Its shape and what you call it. Drinks are drawn in it.' : 'Find the one you pour into. Its size and drawing come with it.',
      body: <GlassWhich value={which} onChange={setWhich} venueModelIds={glasses.flatMap((g) => (g.model_id ? [g.model_id] : []))} venueName={venueName} />,
      next: 'Next',
      canNext: which.mode !== 'find',
    },
    {
      title: 'Where does it come from?',
      body: <SourceQuestion kind="glass" value={src} onChange={setSrc} suppliers={suppliers} />,
      next: 'Next',
      onSkip: () => {
        setSrc({ source: null, supplier_id: null });
        setStep(2);
      },
    },
    {
      title: 'How many?',
      intro: 'If you know. Nothing to make, so that’s it.',
      body: <Field label="How many" value={count} onChangeText={setCount} placeholder="24" keyboardType="number-pad" maxLength={4} error={countOk ? undefined : 'A whole number, 1 to 9999.'} />,
      next: glass ? 'Save' : 'Add the glass',
      canNext: countOk,
      onSkip: () => finish(src, null),
    },
  ];
  const title = trimmed(which.name) ?? GLASS_TYPE_LABEL[which.glass];

  return (
    <KitAddSheet
      visible={visible}
      onClose={onClose}
      label={glass ? `Change ${title}` : 'Add a glass'}
      step={step}
      total={3}
      question={questions[step]}
      onNext={() => (step < 2 ? setStep(step + 1) : finish(src, n))}
      saving={save.isPending}
      error={save.error ? FAILED : null}
    />
  );
}
