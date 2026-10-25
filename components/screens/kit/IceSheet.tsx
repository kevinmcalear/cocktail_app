import { useState, type ReactNode } from 'react';

import { useSaveVenueIce, type VenueIce, type VenueIceChange } from '@/hooks/useVenueIce';
import { useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { iceDrawKind, iceName, type IceKind } from '@/lib/venueKit';

import { KitAddSheet, useOpenKey, type KitQuestion } from './KitAddSheet';
import { IceLooks, looksName, mmOk, type IceLooksValue } from './IceLooks';
import { SourceQuestion, trimmed, type KitSource } from './SourceQuestion';

const FAILED = 'Couldn’t save that. Check your connection and try again.';

export interface IceSheetProps {
  barId: string;
  visible: boolean;
  onClose: () => void;
  /** The ice to change; null adds one. */
  ice?: VenueIce | null;
  /** A new ice already filled in (a wizard's "not in your kit, add it?"). */
  initial?: Partial<VenueIceChange>;
  /** The question it opens on: 0 what it looks like, 1 where it comes from. */
  startAt?: 0 | 1;
  /** After the save, with the ice's id (new or the same) and what was saved. */
  onSaved?: (id: string, ice: VenueIceChange) => void;
  /**
   * Question 3 for ice made here, how do you make it (Kit and ice, step 6):
   * the ice recipes PR fills it. Without it, made-here ice is saved at
   * question 2 and its recipe is written on its page.
   */
  madeStep?: (ice: VenueIceChange) => ReactNode;
}

/** Add ice, or change one: what it looks like, where it comes from, and how you make it when you do. */
export function IceSheet({ startAt = 0, ...props }: IceSheetProps) {
  return <IceSheetBody key={useOpenKey(props.visible)} startAt={startAt} {...props} />;
}

function startLooks(from: Partial<VenueIceChange> | null | undefined): IceLooksValue {
  const v: IceLooksValue = {
    shape: from?.shape ?? 'cubes',
    draw_as: (from?.draw_as as IceKind | null | undefined) ?? null,
    size_mm: from?.size_mm ?? null,
    length_mm: from?.length_mm ?? null,
    clear: from?.clear ?? null,
    stamped: from?.stamped ?? false,
    frozen_inside: from?.frozen_inside ?? '',
    name: null,
  };
  // A name the sheet would give keeps following the answers; the bar's own stays.
  return from?.name && from.name !== iceName(v) ? { ...v, name: from.name } : v;
}

function IceSheetBody({ barId, visible, onClose, ice, initial, startAt, onSaved, madeStep }: IceSheetProps & { startAt: 0 | 1 }) {
  const suppliers = useVenueSuppliers(barId).data ?? [];
  const save = useSaveVenueIce(barId);
  const from = ice ?? initial;
  const [step, setStep] = useState<number>(startAt);
  const [looks, setLooks] = useState(() => startLooks(from));
  // What it said before: Skip leaves it so.
  const [saved] = useState<KitSource>(() => ({ source: from?.source ?? null, supplier_id: from?.supplier_id ?? null, machine: from?.machine ?? '', note: from?.note ?? '' }));
  const [src, setSrc] = useState<KitSource>(saved);

  const change = (source: KitSource): VenueIceChange => ({
    id: ice?.id,
    name: looksName(looks),
    shape: looks.shape,
    draw_as: looks.shape === 'cut' || looks.shape === 'other' ? looks.draw_as : null,
    size_mm: looks.size_mm,
    length_mm: looks.length_mm,
    clear: looks.clear,
    stamped: looks.stamped,
    frozen_inside: trimmed(looks.frozen_inside),
    source: source.source === 'ours' ? null : source.source,
    supplier_id: source.source === 'bought' ? source.supplier_id : null,
    machine: source.source === 'machine' ? trimmed(source.machine) : null,
    note: trimmed(source.note),
  });
  const finish = (source: KitSource) =>
    save.mutate(change(source), {
      onSuccess: (id, saved) => {
        onSaved?.(id, saved);
        onClose();
      },
    });

  const third = !!madeStep && src.source === 'made';
  const total = third ? 3 : 2;
  const looksOk = !!looksName(looks) && mmOk(looks.size_mm) && mmOk(looks.length_mm);
  const questions: KitQuestion[] = [
    {
      title: 'What does it look like in the glass?',
      intro: 'Pick the nearest. It’s what the drawings use.',
      body: <IceLooks value={looks} onChange={setLooks} />,
      next: 'Next',
      canNext: looksOk,
    },
    {
      title: 'Where does it come from?',
      body: <SourceQuestion kind="ice" value={src} onChange={setSrc} suppliers={suppliers} />,
      next: third ? 'Next' : ice ? 'Save' : 'Add ice',
      onSkip: () => finish(saved),
    },
    {
      title: 'How do you make it?',
      intro: 'Start from one of these and change anything. It’s a recipe, like your house preps.',
      body: third ? madeStep(change(src)) : null,
      next: ice ? 'Save' : 'Make it',
    },
  ];

  return (
    <KitAddSheet
      visible={visible}
      onClose={onClose}
      label={ice ? `Change ${ice.name}` : 'Add ice'}
      step={step}
      total={total}
      question={questions[step]}
      onNext={() => (step + 1 < total ? setStep(step + 1) : finish(src))}
      saving={save.isPending}
      error={save.error ? FAILED : null}
    />
  );
}

/** The ice's drawing kind for its thumb: a block or slab is drawn as a large cube. */
export const iceThumbKind = (ice: { shape: string; draw_as: string | null }): IceKind => iceDrawKind(ice) ?? 'large';
