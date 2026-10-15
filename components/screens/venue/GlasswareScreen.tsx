import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { BackbarTheme, Body, Button, Caption, PressableScale, Surface, Tag, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WebHead } from '@/components/WebHead';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarGlassware, useBarPageId, useDeleteBarGlass, useSaveBarGlass, type BarGlass } from '@/hooks/useBarGlassware';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDropdowns } from '@/hooks/useDropdowns';
import { confirmAsync } from '@/lib/dialogs';
import { GLASS_TYPE_LABEL, glassCapacity, glassTitle } from '@/lib/glassware';
import { draftSketchInputs } from '@/lib/sketch/draft';

import { GlassForm } from './GlassForm';

/**
 * Your glassware: the glasses a venue pours into (bar_glassware), each drawn
 * with its size. Each type's main glass is how its drinks are drawn, and a
 * glass that names its maker's page puts the venue on that page. Anyone
 * with Prep changes them (Kit, decided 14 Oct 2026; the database checks too);
 * everyone at the venue can look. "Is this one of your glasses?" in the
 * add-drink wizard and the drink editor adds to it too.
 */
export function GlasswareScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <GlasswarePage barId={barId} />
    </BackbarTheme>
  );
}

function GlasswarePage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const frame = usePageFrame('text');
  const gutter = useGutter();
  const tabBarInset = useTabBarInset();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const { data: caps = [] } = useCapabilities(barId);
  const canEdit = caps.includes('prep');
  const { data: pageId, isLoading: pageLoading } = useBarPageId(barId);
  const { data: glasses = [], isLoading, error } = useBarGlassware(barId);
  const items = useDropdowns().data?.glassware ?? [];
  const save = useSaveBarGlass(barId, pageId);
  const remove = useDeleteBarGlass(barId);
  // The glass open in the form: its id, 'new', or null for none.
  const [open, setOpen] = useState<string | null>(null);
  const editing = open && open !== 'new' ? (glasses.find((g) => g.id === open) ?? null) : null;
  const close = () => {
    setOpen(null);
    save.reset();
    remove.reset();
  };
  const failure = save.error || remove.error ? 'Couldn’t save that. Check your connection and try again.' : null;
  const confirmRemove = async (glass: BarGlass, onDone?: () => void) => {
    if (await confirmAsync({ title: `Remove ${glassTitle(glass)}?`, message: 'It comes off the venue’s glassware and its maker’s page.', confirmText: 'Remove', destructive: true })) {
      remove.mutate(glass.id, { onSuccess: onDone });
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Your glassware</title>
      </WebHead>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: frame.top, paddingBottom: tabBarInset + space.xxxl, paddingHorizontal: gutter }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[frame.column, styles.readable]}>
          {/* On wide web the sidebar is the way around: the "Venue settings" crumb, no Back. */}
          <SubPageHead
            title="Your glassware"
            crumbs={[{ label: 'Venue settings', href: `/settings/bar/${barId}` as Href }]}
            onBack={() => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href))}
          />
          <Body tone="muted">
            The glasses {venue?.name ?? 'the venue'} pours into. Each type’s main glass is how its drinks are drawn, and a glass that names its maker’s page puts
            the venue on that page.
          </Body>
          {isLoading || pageLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load the glassware. Check your connection and try again.</Body> : null}
          {!pageLoading && !pageId ? (
            <Body tone="muted">Glassware sits on the venue’s public page, and this venue doesn’t have one yet. Find it on the map and claim it, then come back.</Body>
          ) : null}

          {pageId && !isLoading ? (
            <>
              {glasses.length ? (
                <Surface style={styles.list}>
                  <View role="list">
                    {glasses.map((g, i) => (
                      <GlassRow
                        key={g.id}
                        glass={g}
                        size={g.model?.capacity_ml ? `${Math.round(g.model.capacity_ml)} ml` : glassCapacity(g, items, barId)}
                        first={i === 0}
                        canEdit={canEdit}
                        onOpen={() => setOpen(g.id)}
                        onRemove={() => void confirmRemove(g, () => open === g.id && close())}
                      />
                    ))}
                  </View>
                </Surface>
              ) : error || canEdit ? null : (
                // A failed load already says so: an empty list here would be wrong.
                <Body tone="muted">No glasses listed yet.</Body>
              )}
              {canEdit && open ? (
                <Surface style={styles.card}>
                  <GlassForm
                    key={open}
                    glass={editing}
                    saving={save.isPending}
                    deleting={remove.isPending}
                    error={failure}
                    onSave={(row) => save.mutate(row, { onSuccess: close })}
                    onCancel={close}
                    onDelete={editing ? () => void confirmRemove(editing, close) : undefined}
                    venueModelIds={glasses.flatMap((g) => (g.model_id ? [g.model_id] : []))}
                    venueName={venue?.name}
                  />
                </Surface>
              ) : canEdit ? (
                <AddSlot first={!glasses.length} onPress={() => setOpen('new')} />
              ) : (
                <Caption tone="muted">You can look, but changing the kit needs Prep at this venue.</Caption>
              )}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// An empty glass, sketched (as the glass form draws it).
const EMPTY = draftSketchInputs({ name: '', lines: [] });

/** The glass, sketched on paper. */
function GlassDrawing({ glass }: { glass: BarGlass }) {
  const ds = useDs();
  const inputs = useMemo(() => ({ ...EMPTY, glass: glass.glass, variant: glass.variant }), [glass.glass, glass.variant]);
  return (
    <View style={[styles.paper, { backgroundColor: ds.c.paper }]} aria-hidden>
      <SketchDrawing inputs={inputs} seed="bar-glass" detail="thumb" />
    </View>
  );
}

interface GlassRowProps {
  glass: BarGlass;
  /** "180 ml": a real glass's, else the glassware item's of the same name. */
  size: string | null;
  first: boolean;
  canEdit: boolean;
  onOpen: () => void;
  onRemove: () => void;
}

function GlassRow({ glass, size, first, canEdit, onOpen, onRemove }: GlassRowProps) {
  const ds = useDs();
  const title = glassTitle(glass);
  const maker = glass.maker_page?.display_name ?? glass.maker;
  // The type only when the name doesn't already say it ("Rocks" under "Rocks").
  const type = GLASS_TYPE_LABEL[glass.glass] === title ? null : GLASS_TYPE_LABEL[glass.glass];
  const detail = [type, size, maker ? `by ${maker}` : null, glass.series].filter(Boolean).join(' · ');
  const body = (
    <>
      <GlassDrawing glass={glass} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{title}</Body>
        <Caption tone="muted" numberOfLines={2}>
          {detail}
        </Caption>
      </View>
      {glass.is_default ? <Tag label="Main" /> : null}
    </>
  );
  const style = [styles.row, first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }];
  if (!canEdit) {
    return (
      <View role="listitem" style={style}>
        {body}
      </View>
    );
  }
  return (
    <View role="listitem" style={style}>
      <PressableScale role="button" accessibilityLabel={`Change ${title}. ${detail}`} onPress={onOpen} style={[styles.row, styles.flex]}>
        {body}
      </PressableScale>
      <Button label="Remove" size="sm" variant="ghost" accessibilityLabel={`Remove ${title}`} onPress={onRemove} />
    </View>
  );
}

/** The empty slot at the end: room for another glass. */
function AddSlot({ first, onPress }: { first: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Add a glass" onPress={onPress} style={[styles.slot, { borderColor: ds.c.lineStrong }]}>
      <View style={[styles.paper, styles.slotMark]}>
        <IconSymbol name="plus" size={20} color={ds.accentText} />
      </View>
      <View style={styles.flex}>
        <Body color={ds.accentText}>Add a glass</Body>
        <Caption tone="muted">{first ? 'List the glasses you pour into, and drinks are drawn in them.' : 'Room for another, whenever you get one.'}</Caption>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { gap: space.lg },
  list: { paddingVertical: space.xs },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
  paper: { width: 48, height: 48, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.card, borderCurve: 'continuous' },
  slotMark: { backgroundColor: 'transparent' },
});
