import { useState } from 'react';

import { Body, Caption } from '@/components/ds';
import { IceThumb } from '@/components/ds/IceThumb';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { GlassSheet } from '@/components/screens/kit/GlassSheet';
import { IceSheet, iceThumbKind } from '@/components/screens/kit/IceSheet';
import { drawnLine, GlassPhoto, RedrawLinks, SavedNote, ShareGlass, tracedFacts } from '@/components/screens/kit/draw/TracedGlass';
import { KitItemPage } from '@/components/screens/kit/KitItemPage';
import { KitList } from '@/components/screens/kit/KitList';
import { KitPage, useCloseKitItem, useJustDrawn, useOpenDrawnGlass, useOpenKitItem } from '@/components/screens/kit/KitPage';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { useHomeGlassware, useHomeIce, useRemoveHomeGlass, useRemoveHomeIce, useSaveHomeGlass, useSaveHomeIce } from '@/hooks/useHomeKit';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import type { VenueIce } from '@/hooks/useVenueIce';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import { iceLooksLine, inTheGlass, kitLine, kitSourceLine } from '@/lib/venueKit';

const FAILED = 'Couldn’t save that. Check your connection and try again.';

const glassName = (g: BarGlass) => (g.name && g.name !== g.model?.name ? g.name : GLASS_TYPE_LABEL[g.glass]);
const realGlass = (g: BarGlass) => (g.model ? [g.model.maker?.display_name, g.model.name].filter(Boolean).join(' ') : g.outline ? drawnLine(g) : null);
// At home "bought" has no supplier: from a shop.
const glassFrom = (g: BarGlass) => (g.source === 'bought' ? 'Bought' : kitSourceLine({ source: g.source, supplier_name: null, note: null }));
const iceFrom = (i: VenueIce) => kitSourceLine({ ...i, length_mm: null });

/**
 * My Bar › Kit › Glassware (Kit and ice, step 13): the same list, page and
 * sheet as a venue's, for the glasses you have at home. Optional: drinks are
 * drawn with our guess until you add yours.
 */
export function HomeGlasswareScreen({ openId }: { openId?: string | null }) {
  const { data: glasses = [], isLoading, error } = useHomeGlassware();
  const save = useSaveHomeGlass();
  const remove = useRemoveHomeGlass();
  const wide = useIsWideWeb();
  const open = useOpenKitItem(null, 'glassware', openId);
  const close = useCloseKitItem(null, 'glassware');
  const [sheet, setSheet] = useState<{ glass: BarGlass | null; startAt: 0 | 1 | 2; draw?: 'photo' | 'size' } | null>(null);
  const justDrawn = useJustDrawn();
  const openDrawn = useOpenDrawnGlass(null, openId);
  const opened = openId ? (glasses.find((g) => g.id === openId) ?? null) : null;
  const change = (at: 0 | 1 | 2, draw?: 'photo' | 'size') => () => setSheet({ glass: opened, startAt: at, draw });

  return (
    <>
      <KitPage
        barId={null}
        kind="glassware"
        title="Glassware"
        intro="The glasses you have at home, and where they came from. Optional."
        openId={openId}
        openName={opened ? glassName(opened) : null}
        loading={isLoading}
        failed={!!error}
        list={
          error ? (
            <Body tone="muted">Couldn’t load your glassware. Check your connection and try again.</Body>
          ) : isLoading ? (
            <Caption tone="muted">Loading…</Caption>
          ) : (
            <KitList
              sections={[{ entries: glasses.map((g) => ({ id: g.id, name: glassName(g), line: kitLine([realGlass(g) ?? 'Not matched to a real glass yet', glassFrom(g)]), thumb: <GlassThumb glass={g.glass} variant={g.variant} outline={g.outline ?? g.model?.outline} /> })) }]}
              openId={openId}
              onOpen={open}
              addLabel="Add a glass"
              onAdd={() => setSheet({ glass: null, startAt: 0 })}
              empty="No glasses yet. Drinks are drawn in the glass their spec names."
            />
          )
        }
        item={
          opened ? (
            <KitItemPage
              kind="Glassware"
              name={glassName(opened)}
              showTitle={wide}
              notice={justDrawn ? <SavedNote where="your glassware" /> : null}
              thumb={<GlassThumb glass={opened.glass} variant={opened.variant} outline={opened.outline ?? opened.model?.outline} size={72} />}
              facts={[
                { label: 'Which glass', value: realGlass(opened) ?? 'Not matched to a real glass yet', onChange: change(0) },
                ...tracedFacts(opened, change(0, 'size')),
                { label: 'Where it comes from', value: glassFrom(opened) || 'Not said yet', onChange: change(1) },
                { label: 'How many', value: opened.count ? String(opened.count) : 'Not said yet', onChange: change(2) },
              ]}
              onEdit={change(0)}
              onRemove={() => remove.mutate(opened.id, { onSuccess: close })}
              removing={remove.isPending}
              error={remove.error || save.error ? FAILED : null}
            >
              {opened.outline ? (
                <>
                  <ShareGlass glass={opened} home venueName="" canEdit />
                  <GlassPhoto glass={opened} home venueName="" canEdit invalidate={['home-glassware']} />
                  <RedrawLinks glass={opened} onRedraw={change(0, 'photo')} onFix={change(0, 'size')} />
                </>
              ) : null}
            </KitItemPage>
          ) : null
        }
      />
      <GlassSheet
        barId={null}
        pageId={null}
        home
        visible={!!sheet}
        glass={sheet?.glass}
        startAt={sheet?.startAt}
        draw={sheet?.draw}
        onClose={() => setSheet(null)}
        onSave={(row) => save.mutateAsync({ ...row, is_default: !glasses.some((g) => g.id !== row.id && g.glass === row.glass && g.is_default) })}
        onSaved={(id, wasDrawn) => {
          if (wasDrawn && id) openDrawn(id);
        }}
      />
    </>
  );
}

/**
 * My Bar › Kit › Ice (Kit and ice, step 13): in the glass, then blocks and
 * slabs to cut from, each bought, from your machine or made here.
 */
export function HomeIceScreen({ openId }: { openId?: string | null }) {
  const { data: ices = [], isLoading, error } = useHomeIce();
  const save = useSaveHomeIce();
  const remove = useRemoveHomeIce();
  const wide = useIsWideWeb();
  const open = useOpenKitItem(null, 'ice', openId);
  const close = useCloseKitItem(null, 'ice');
  const [sheet, setSheet] = useState<{ ice: VenueIce | null; startAt: 0 | 1 } | null>(null);
  const opened = openId ? (ices.find((i) => i.id === openId) ?? null) : null;
  const entry = (i: VenueIce) => ({ id: i.id, name: i.name, line: iceFrom(i), thumb: <IceThumb kind={iceThumbKind(i)} /> });

  return (
    <>
      <KitPage
        barId={null}
        kind="ice"
        title="Ice"
        intro="The ice you make or buy at home. Optional."
        openId={openId}
        openName={opened?.name}
        loading={isLoading}
        failed={!!error}
        list={
          error ? (
            <Body tone="muted">Couldn’t load your ice. Check your connection and try again.</Body>
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
              onAdd={() => setSheet({ ice: null, startAt: 0 })}
              empty="No ice yet. Drinks are drawn with the ice their spec names."
            />
          )
        }
        item={
          opened ? (
            <KitItemPage
              kind="Ice"
              name={opened.name}
              showTitle={wide}
              thumb={<IceThumb kind={iceThumbKind(opened)} size={72} />}
              facts={[
                { label: 'Looks like', value: iceLooksLine(opened), onChange: () => setSheet({ ice: opened, startAt: 0 }) },
                { label: 'Where it comes from', value: iceFrom(opened) || 'Not said yet', onChange: () => setSheet({ ice: opened, startAt: 1 }) },
              ]}
              onEdit={() => setSheet({ ice: opened, startAt: 0 })}
              onRemove={() => remove.mutate(opened.id, { onSuccess: close })}
              removing={remove.isPending}
              error={remove.error ? FAILED : null}
            />
          ) : null
        }
      />
      <IceSheet barId={null} visible={!!sheet} ice={sheet?.ice} startAt={sheet?.startAt} save={save} onClose={() => setSheet(null)} />
    </>
  );
}
