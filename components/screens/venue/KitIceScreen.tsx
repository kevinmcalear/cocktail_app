import { useState } from 'react';

import { Body, Caption } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { IceSheet, iceThumbKind } from '@/components/screens/kit/IceSheet';
import { KitItemPage } from '@/components/screens/kit/KitItemPage';
import { KitList, type KitEntry } from '@/components/screens/kit/KitList';
import { KitPage, useCloseKitItem, useOpenKitItem } from '@/components/screens/kit/KitPage';
import { IceRecipeSection } from '@/components/screens/ice/IceRecipeSection';
import { useIceAddMade } from '@/components/screens/ice/useIceAddMade';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useRemoveVenueIce, useVenueIce, type VenueIce } from '@/hooks/useVenueIce';
import { iceLooksLine, inTheGlass, kitSourceLine } from '@/lib/venueKit';

// The name already says a Collins block's or block's length.
const iceFrom = (i: VenueIce) => kitSourceLine({ ...i, length_mm: null });

/**
 * Kit: Ice (Kit and ice, steps 1 to 5). The ice a venue pours, in the glass
 * and the blocks and slabs it cuts from, each with where it comes from. Add
 * ice opens the shared Add sheet; one opens on its own page. Anyone with
 * Prep changes it.
 */
export function KitIceScreen({ barId, openId }: { barId: string; openId?: string | null }) {
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const canEdit = (useCapabilities(barId).data ?? []).includes('prep');
  const { data: ices = [], isLoading, error } = useVenueIce(barId);
  const open = useOpenKitItem(barId, 'ice', openId);
  // The sheet: adding (no ice), changing one, and the question it opens on.
  const [sheet, setSheet] = useState<{ ice: VenueIce | null; startAt: 0 | 1 } | null>(null);
  const opened = openId ? (ices.find((i) => i.id === openId) ?? null) : null;
  // Adding ice made here asks how (question 3) and starts its recipe from the answer.
  const made = useIceAddMade(barId, ices);
  const entry = (i: VenueIce): KitEntry => ({ id: i.id, name: i.name, line: iceFrom(i), thumb: <IceThumb kind={iceThumbKind(i)} /> });

  const list = error ? (
    <Body tone="muted">Couldn’t load the ice. Check your connection and try again.</Body>
  ) : isLoading ? (
    <Caption tone="muted">Loading…</Caption>
  ) : (
    <KitList
      sections={[
        { title: 'In the glass', entries: ices.filter(inTheGlass).map(entry) },
        { title: 'Blocks and slabs, to cut from', entries: ices.filter((i) => !inTheGlass(i)).map(entry) },
      ]}
      openId={openId}
      onOpen={open}
      addLabel="Add ice"
      onAdd={canEdit ? () => setSheet({ ice: null, startAt: 0 }) : undefined}
      empty="No ice listed yet."
    />
  );

  return (
    <>
      <KitPage
        barId={barId}
        kind="ice"
        title="Ice"
        intro={`The ice ${venue?.name ?? 'the venue'} pours, and how each one gets here. Drinks are drawn with it, and the wizard offers it first.`}
        openId={openId}
        openName={opened?.name}
        loading={isLoading}
        failed={!!error}
        list={list}
        item={opened ? <IcePage barId={barId} ice={opened} canEdit={canEdit} onChange={(startAt) => setSheet({ ice: opened, startAt })} /> : null}
      />
      <IceSheet
        barId={barId}
        visible={!!sheet}
        ice={sheet?.ice}
        startAt={sheet?.startAt}
        onClose={() => (setSheet(null), made.reset())}
        madeStep={sheet && !sheet.ice ? made.madeStep : undefined}
        // The ice is saved either way; if its starting recipe fails, its recipe page asks again.
        onSaved={(id, ice) => void made.onSaved(id, ice).catch(() => undefined)}
      />
    </>
  );
}

/** One ice, opened (step 2): what it looks like, where it comes from, and how it's made. */
function IcePage({ barId, ice, canEdit, onChange }: { barId: string; ice: VenueIce; canEdit: boolean; onChange: (startAt: 0 | 1) => void }) {
  const wide = useIsWideWeb();
  const close = useCloseKitItem(barId, 'ice');
  const remove = useRemoveVenueIce(barId);
  const from = iceFrom(ice);
  return (
    <KitItemPage
      kind="Ice"
      name={ice.name}
      showTitle={wide}
      thumb={<IceThumb kind={iceThumbKind(ice)} size={72} />}
      facts={[
        { label: 'Looks like', value: iceLooksLine(ice), onChange: canEdit ? () => onChange(0) : undefined },
        { label: 'Where it comes from', value: from || 'Not said yet', onChange: canEdit ? () => onChange(1) : undefined },
      ]}
      onEdit={canEdit ? () => onChange(0) : undefined}
      onRemove={canEdit ? () => remove.mutate(ice.id, { onSuccess: close }) : undefined}
      removing={remove.isPending}
      error={remove.error ? ((remove.error as { code?: string }).code === '23503' ? remove.error.message : 'Couldn’t remove it. Check your connection and try again.') : null}
    >
      {ice.source === 'made' ? <IceRecipeSection barId={barId} ice={ice} canEdit={canEdit} /> : null}
    </KitItemPage>
  );
}
