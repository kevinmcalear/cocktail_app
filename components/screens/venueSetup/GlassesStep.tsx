import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface, useDs } from '@/components/ds';
import { GlassModelPicker, GlassThumb } from '@/components/glass/GlassModelPicker';
import { GlassSheet } from '@/components/screens/kit/GlassSheet';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { fontFamilies, space } from '@/constants/tokens';
import { useBarGlassware, useDeleteBarGlass, useHeldGlasses, useSaveBarGlass } from '@/hooks/useBarGlassware';
import type { GlassModel } from '@/hooks/useGlassModels';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { anyLine, kindOf, kindRow, type GlassKind } from '@/lib/glassKinds';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import type { SketchGlass } from '@/lib/sketch/types';
import { heldNotOnPage } from '@/lib/whatNext';
import { useVenueSetup } from '@/store/useVenueSetup';

import { GlassKindGrid } from './GlassKindGrid';

/** Skip and the main button side by side, as the board pins them. */
export function StepFooter({ skip, onSkip, label, onPress, disabled }: { skip: string; onSkip: () => void; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={styles.footer}>
      <Button label={skip} variant="secondary" size="lg" onPress={onSkip} />
      <Button label={label} size="lg" onPress={onPress} disabled={disabled} style={styles.flex} />
    </View>
  );
}

/** A glass on the list: on the venue's page (`id`), or held on the device until the page is checked. */
interface Listed {
  key: string;
  id: string | null;
  glass: SketchGlass;
  variant: string | null;
  name: string | null;
  model_id?: string | null;
  /** "Urban Bar Retro Coupette 15cl": the real glass, when there is one. */
  real: string | null;
  is_default: boolean;
}

/** What the venue calls it: its own name ("Double rocks"), else its kind. */
const titleOf = (l: Listed) => l.name ?? kindOf(l)?.label ?? GLASS_TYPE_LABEL[l.glass];
/** "coupe", "Nick & Nora": the kind in a sentence. */
const kindWord = (l: Listed) => (l.glass === 'nick' && !l.name ? GLASS_TYPE_LABEL.nick : titleOf(l).toLowerCase());

/**
 * Kit › Glassware in setup (owner-setup step 6, call 9): kinds first. Tap
 * Coupe and "any coupe" is on the list at once, drawn, with no model and no
 * count; the real glass is optional and comes after (Add the model). Glassware
 * hangs off the venue's page, so before it's checked (no `pageId`) glasses are
 * held on the device and go onto the page once it is (useFlushHeldGlasses).
 */
export function GlassesStep({ barId, pageId, name }: { barId: string; pageId: string | null; name: string }) {
  const ds = useDs();
  const wide = useIsWideWeb();
  const client = useQueryClient();
  const glasses = useBarGlassware(barId).data ?? [];
  const held = useHeldGlasses(barId);
  const holdGlass = useVenueSetup((s) => s.holdGlass);
  const dropGlass = useVenueSetup((s) => s.dropGlass);
  const save = useSaveBarGlass(barId, pageId);
  const remove = useDeleteBarGlass(barId);
  // Taps not saved yet, by kind: a tile shows its tick straight away.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  // Kinds tapped on this visit: "Just added".
  const [added, setAdded] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [describing, setDescribing] = useState(false);
  // The glass whose model is being picked; on a wide screen the newest kind on its own, until Not now.
  const [modelFor, setModelFor] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const listed: Listed[] = [
    ...glasses.map((g) => ({ key: g.id, id: g.id, glass: g.glass, variant: g.variant, name: g.name && g.name !== g.model?.name ? g.name : null, model_id: g.model_id, real: g.model ? [g.model.maker?.display_name, g.model.name].filter(Boolean).join(' ') : null, is_default: g.is_default })),
    // A held catalog glass keeps its maker and name to show meanwhile.
    ...heldNotOnPage(held, glasses).map((h) => ({ ...h, id: null, name: h.model_id ? null : h.name, real: h.model_id ? [h.maker, h.name].filter(Boolean).join(' ') : null })),
  ];
  const mine = (k: GlassKind) => listed.filter((l) => !l.model_id && kindOf(l)?.key === k.key);
  const on = (k: GlassKind) => pending[k.key] ?? listed.some((l) => kindOf(l)?.key === k.key);

  const toggle = async (k: GlassKind) => {
    if (k.key in pending) return;
    const own = mine(k);
    // On the list only as a real glass: that stays (Kit › Glassware takes it off).
    if (on(k) && !own.length) return;
    if (!pageId) {
      if (own.length) for (const l of own) dropGlass(barId, l.key);
      else {
        holdGlass(barId, { key: `kind-${k.key}`, ...kindRow(k, listed) });
        setAdded((a) => [...a, k.key]);
        setDismissed(false);
      }
      return;
    }
    setPending((p) => ({ ...p, [k.key]: !own.length }));
    setFailed(false);
    try {
      if (own.length) for (const l of own) await remove.mutateAsync(l.id!);
      else {
        await save.mutateAsync(kindRow(k, glasses));
        setAdded((a) => [...a, k.key]);
        // A new kind brings the wide screen's model card back for it.
        setDismissed(false);
      }
      await client.refetchQueries({ queryKey: ['bar-glassware', barId] });
    } catch {
      setFailed(true);
    } finally {
      setPending(({ [k.key]: _done, ...rest }) => rest);
    }
  };

  // The real glass for one on its own: the row becomes that glass, keeping whether it's the main one.
  const pick = (l: Listed, m: GlassModel) => {
    const is_default = m.glass === l.glass ? l.is_default : !listed.some((o) => o.key !== l.key && o.glass === m.glass && o.is_default);
    const row = { glass: m.glass, variant: m.variant, name: null, maker: null, maker_profile_id: null, designer: null, series: null, shape_note: null, model_id: m.id, is_default };
    setFailed(false);
    if (l.id) save.mutate({ id: l.id, ...row }, { onError: () => setFailed(true) });
    else {
      // Held under the model's id: the kind's key is free for that kind again.
      dropGlass(barId, l.key);
      holdGlass(barId, { key: m.id, ...row, name: m.name, maker: m.maker?.display_name ?? null });
    }
    setModelFor(null);
    setDismissed(true);
  };

  const newest = [...listed].reverse().find((l) => !l.model_id);
  const target = listed.find((l) => !l.model_id && l.key === (modelFor ?? (wide && !dismissed ? newest?.key : null)));

  const list = listed.length ? (
    <View style={styles.stack}>
      <SectionHeading>{`Added · ${listed.length}`}</SectionHeading>
      <Surface style={styles.card}>
        <View role="list">
          {listed.map((l, i) => {
            const line = l.real ?? anyLine(l);
            const just = !l.model_id && added.includes(kindOf(l)?.key ?? '');
            return (
              <View key={l.key} role="listitem" style={[styles.row, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                <GlassThumb glass={l.glass} variant={l.variant} size={52} />
                <View style={styles.flex}>
                  <Body numberOfLines={1}>{titleOf(l)}</Body>
                  <Caption tone="muted" numberOfLines={2}>
                    {just ? `Just added · ${line.charAt(0).toLowerCase()}${line.slice(1)}` : line}
                  </Caption>
                </View>
                {l.model_id ? null : <Button label="Add the model" variant="ghost" size="sm" accessibilityLabel={`Add the model for ${titleOf(l)}`} onPress={() => setModelFor(l.key)} />}
              </View>
            );
          })}
        </View>
      </Surface>
    </View>
  ) : null;

  const model = target ? (
    <Surface style={styles.model}>
      <Body style={styles.strong}>{`Which ${kindWord(target)} exactly? Optional`}</Body>
      <GlassModelPicker
        key={target.key}
        // Search first, as drawn; glasses of its kind come first in what it finds.
        preferGlass={target.glass}
        venueModelIds={listed.flatMap((l) => (l.model_id ? [l.model_id] : []))}
        venueName={name}
        onPick={(m) => pick(target, m)}
      />
      <Button
        label="Not now"
        variant="ghost"
        onPress={() => {
          setModelFor(null);
          setDismissed(true);
        }}
        style={styles.start}
      />
    </Surface>
  ) : null;

  const kinds = (
    <View style={styles.stack}>
      <SectionHeading>What do you pour into? Tap all that apply</SectionHeading>
      <GlassKindGrid on={on} fixed={(k) => on(k) && !mine(k).length} onToggle={(k) => void toggle(k)} onOther={() => setDescribing(true)} />
    </View>
  );

  return (
    <>
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.left}>
            {list}
            {model}
          </View>
          <View style={styles.flex}>{kinds}</View>
        </View>
      ) : (
        <>
          {list}
          {model}
          {kinds}
        </>
      )}
      {pageId ? null : <Caption tone="muted">{`Kept with your setup. They go on ${name}’s page once we’ve checked it’s yours.`}</Caption>}
      {failed ? (
        <Caption tone="accent" role="alert">
          Couldn’t change your glasses. Check your connection and try again.
        </Caption>
      ) : null}
      <GlassSheet
        barId={barId}
        pageId={pageId}
        visible={describing}
        describe
        venueName={name}
        onClose={() => setDescribing(false)}
        // Before the page is checked, held on the device like the rest.
        onSave={pageId ? undefined : (row) => holdGlass(barId, { ...row, key: `own-${Date.now()}` })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: space.sm },
  card: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 68, paddingVertical: space.sm, paddingHorizontal: space.xs },
  model: { gap: space.md, padding: space.lg },
  strong: { fontFamily: fontFamilies.bodyMedium },
  start: { alignSelf: 'flex-start' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  left: { flex: 1, minWidth: 0, maxWidth: 360, gap: space.lg },
});
