import { useState } from 'react';

import { Body, Caption } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { GlassSheet } from '@/components/screens/kit/GlassSheet';
import { DrinksDrawnIn, drawnLine, GlassPhoto, RedrawLinks, SavedNote, ShareGlass, tracedFacts } from '@/components/screens/kit/draw/TracedGlass';
import { KitItemPage } from '@/components/screens/kit/KitItemPage';
import { KitList } from '@/components/screens/kit/KitList';
import { KitPage, useCloseKitItem, useOpenKitItem } from '@/components/screens/kit/KitPage';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarGlassware, useBarPageId, useDeleteBarGlass, useSaveBarGlass, type BarGlass } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDropdowns } from '@/hooks/useDropdowns';
import { glassModelSize } from '@/hooks/useGlassModels';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { GLASS_TYPE_LABEL, glassCapacity } from '@/lib/glassware';
import { kitLine, kitSourceLine } from '@/lib/venueKit';

const FAILED = 'Couldn’t save that. Check your connection and try again.';

/** What the venue calls it: its own name, else its type ("Coupe"). A real glass's own name is said under it. */
const glassName = (g: BarGlass) => (g.name && g.name !== g.model?.name ? g.name : GLASS_TYPE_LABEL[g.glass]);
/** The real glass it is: "Urban Bar Retro Coupette 15cl", or one drawn from the venue's photo. */
const realGlass = (g: BarGlass) => (g.model ? [g.model.maker?.display_name, g.model.name].filter(Boolean).join(' ') : g.outline ? drawnLine(g) : null);
const source = (g: BarGlass) => kitSourceLine({ source: g.source, supplier_name: g.supplier_name, note: null });

/**
 * Kit: Glassware (Kit and ice, steps 1 to 3). The glasses a venue pours into
 * (bar_glassware), each drawn, with the real glass it is and where it came
 * from. Each type's main glass is how its drinks are drawn; a real glass
 * puts the venue on its maker's page. Anyone with Prep changes them.
 */
export function GlasswareScreen({ barId, openId }: { barId: string; openId?: string | null }) {
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const canEdit = (useCapabilities(barId).data ?? []).includes('prep');
  const { data: pageId, isLoading: pageLoading } = useBarPageId(barId);
  const { data: glasses = [], isLoading, error } = useBarGlassware(barId);
  const open = useOpenKitItem(barId, 'glassware', openId);
  const [sheet, setSheet] = useState<{ glass: BarGlass | null; startAt: 0 | 1 | 2; draw?: 'photo' | 'size' } | null>(null);
  // A glass just drawn from a photo: its page opens saying so (Draw my glass, step 6).
  const [drawn, setDrawn] = useState<string | null>(null);
  const opened = openId ? (glasses.find((g) => g.id === openId) ?? null) : null;

  const list = error ? (
    <Body tone="muted">Couldn’t load the glassware. Check your connection and try again.</Body>
  ) : isLoading || pageLoading ? (
    <Caption tone="muted">Loading…</Caption>
  ) : !pageId ? (
    <Body tone="muted">Glassware sits on the venue’s public page, and this venue doesn’t have one yet. Find it on the map and claim it, then come back.</Body>
  ) : (
    <KitList
      sections={[
        {
          entries: glasses.map((g) => ({
            id: g.id,
            name: glassName(g),
            line: kitLine([realGlass(g) ?? 'Not matched to a real glass yet', source(g)]),
            thumb: <GlassThumb glass={g.glass} variant={g.variant} outline={g.outline} />,
          })),
        },
      ]}
      openId={openId}
      onOpen={open}
      addLabel="Add a glass"
      onAdd={canEdit ? () => setSheet({ glass: null, startAt: 0 }) : undefined}
      empty="No glasses listed yet."
    />
  );

  return (
    <>
      <KitPage
        barId={barId}
        kind="glassware"
        title="Glassware"
        intro={`The glasses ${venue?.name ?? 'the venue'} pours into. Drinks are drawn in them, and the wizard offers them first.`}
        openId={openId}
        openName={opened ? glassName(opened) : null}
        loading={isLoading || pageLoading}
        failed={!!error}
        list={list}
        item={
          opened ? (
            <GlassPage
              barId={barId}
              pageId={pageId ?? null}
              glass={opened}
              others={glasses}
              canEdit={canEdit}
              venueName={venue?.name ?? 'the venue'}
              justDrawn={drawn === opened.id}
              onChange={(startAt, draw) => setSheet({ glass: opened, startAt, draw })}
            />
          ) : null
        }
      />
      <GlassSheet
        barId={barId}
        pageId={pageId ?? null}
        visible={!!sheet}
        glass={sheet?.glass}
        startAt={sheet?.startAt}
        draw={sheet?.draw}
        venueName={venue?.name}
        onClose={() => setSheet(null)}
        onSaved={(id, wasDrawn) => {
          if (!wasDrawn || !id) return;
          setDrawn(id);
          if (id !== openId) open(id);
        }}
      />
    </>
  );
}

interface GlassPageProps {
  barId: string;
  pageId: string | null;
  glass: BarGlass;
  /** The venue's glasses: another of the same type can be the one its drinks are drawn in. */
  others: readonly BarGlass[];
  canEdit: boolean;
  venueName: string;
  /** Just drawn from a photo: say it's saved and what's next. */
  justDrawn: boolean;
  onChange: (startAt: 0 | 1 | 2, draw?: 'photo' | 'size') => void;
}

/** One glass, opened (step 2): which glass, where it comes from, how many. */
function GlassPage({ barId, pageId, glass, others, canEdit, venueName, justDrawn, onChange }: GlassPageProps) {
  const wide = useIsWideWeb();
  const close = useCloseKitItem(barId, 'glassware');
  const items = useDropdowns().data?.glassware ?? [];
  const save = useSaveBarGlass(barId, pageId);
  const remove = useDeleteBarGlass(barId);
  const change = (at: 0 | 1 | 2) => (canEdit ? () => onChange(at) : undefined);
  const size = (glass.model && glassModelSize(glass.model)) ?? glassCapacity(glass, items, barId);
  const sameType = others.filter((g) => g.glass === glass.glass);
  const type = GLASS_TYPE_LABEL[glass.glass];
  const main = sameType.find((g) => g.is_default);
  const makeMain = () => {
    const { id, glass: shape, variant, name, maker, maker_profile_id, designer, series, shape_note, model_id, model } = glass;
    // A real glass's maker, series and designer stay on its model (withModel fills them in when read).
    const own = model ? { maker: null, maker_profile_id: null, designer: null, series: null } : { maker, maker_profile_id, designer, series };
    save.mutate({ id, glass: shape, variant, name, shape_note, model_id, ...own, is_default: true });
  };
  return (
    <KitItemPage
      kind="Glassware"
      name={glassName(glass)}
      showTitle={wide}
      notice={justDrawn ? <SavedNote where={`${venueName}’s glassware`} /> : null}
      thumb={<GlassThumb glass={glass.glass} variant={glass.variant} outline={glass.outline} size={72} />}
      facts={[
        { label: 'Which glass', value: [realGlass(glass) ?? 'Not matched to a real glass yet', glass.outline ? null : size].filter(Boolean).join(' · '), onChange: change(0) },
        ...tracedFacts(glass, canEdit ? () => onChange(0, 'size') : undefined),
        { label: 'Where it comes from', value: source(glass) || 'Not said yet', onChange: change(1) },
        { label: 'How many', value: glass.count ? String(glass.count) : 'Not said yet', onChange: change(2) },
        ...(sameType.length > 1
          ? [
              {
                label: `${type} drinks are drawn in`,
                value: glass.is_default ? 'This one' : main ? glassName(main) : 'Neither yet',
                onChange: canEdit && !glass.is_default ? makeMain : undefined,
              },
            ]
          : []),
      ]}
      onEdit={change(0)}
      onRemove={canEdit ? () => remove.mutate(glass.id, { onSuccess: close }) : undefined}
      removing={remove.isPending}
      error={save.error || remove.error ? FAILED : null}
    >
      {glass.outline ? (
        <>
          <DrinksDrawnIn barId={barId} glass={glass} />
          <ShareGlass glass={glass} home={false} venueName={venueName} canEdit={canEdit} />
          <GlassPhoto glass={glass} home={false} venueName={venueName} canEdit={canEdit} invalidate={['bar-glassware', barId]} />
          {canEdit ? <RedrawLinks glass={glass} onRedraw={() => onChange(0, 'photo')} onFix={() => onChange(0, 'size')} /> : null}
        </>
      ) : null}
    </KitItemPage>
  );
}
