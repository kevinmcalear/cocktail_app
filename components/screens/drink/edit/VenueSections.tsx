import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, Headline, PressableScale, Sheet, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useSetDrinkPrice } from '@/hooks/useDrinkCost';
import { useItemPublishing } from '@/hooks/usePublishing';
import { useRankTarget } from '@/hooks/useRankings';
import { useSaveServiceNotes, useServiceNotes } from '@/hooks/useServiceNotes';
import { useSetLineService, useSetServiceStyle } from '@/hooks/useServiceSpec';
import { PUBLISH_COPY } from '@/lib/publishing';
import { isServiceStyle } from '@/lib/service';
import { EMPTY_SERVICE_NOTES, handoffSteps, handoffText, MAX_HANDOFF_STEPS, type ServiceNotes } from '@/lib/serviceNotes';
import { specLines, type PresentationRecipe } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import { PublishSection } from '../../publishing/PublishSection';
import { ClassicLink } from '../ClassicLink';
import { GlassSheet } from '../GlassSheet';
import { ServiceSpec } from '../ServiceSpec';
import { useDrinkGlass } from '../useDrinkFacts';
import { EditPrice } from './EditPrice';

/** The sheets these sections open. The editor holds which is open, so its Escape closes the sheet, not the editor. */
export type VenueSheet = 'classic' | 'publish' | 'glass';

/** What these sections still have to save when the editor's Done is pressed. */
export interface PendingEdits {
  dirty: boolean;
  /** False when something didn't save; it says why in place. */
  save: () => Promise<boolean>;
}

interface VenueSectionsProps {
  item: DatabaseItem;
  /** Hands the editor what's left to save, after every change. */
  onPending: (pending: PendingEdits) => void;
  sheet: VenueSheet | null;
  onSheet: (sheet: VenueSheet | null) => void;
  /** Phone: the service photos sit in Service. Wide keeps them under the hero. */
  servicePhotos?: ReactNode;
}

/**
 * What used to change from the drink page, now only here (board
 * drink-read-and-edit, Kevin 23 Oct): For the floor, Service, Price and what
 * the drink is linked to. Typed text saves with Done; a pick (how it goes
 * out, a line at the station, the classic, who can see it) saves as it's made,
 * as the photos do.
 */
export function VenueSections(props: VenueSectionsProps) {
  const barId = props.item.bar_id;
  const { data: notes, isPending } = useServiceNotes(props.item.id, barId, !!barId);
  // The boxes start from the saved notes, so wait for them. Without them, saving a box would blank the rest.
  if (barId && isPending) return props.servicePhotos ?? null;
  if (barId && !notes) {
    return (
      <>
        <Caption tone="accent">{"Couldn't load the floor and service notes. Check your connection and open Edit again."}</Caption>
        {props.servicePhotos}
      </>
    );
  }
  return <Sections {...props} notes={notes ?? EMPTY_SERVICE_NOTES} />;
}

function Sections({ item, onPending, sheet: open, onSheet: setOpen, servicePhotos, notes }: VenueSectionsProps & { notes: ServiceNotes }) {
  const barId = item.bar_id;
  const saveNotes = useSaveServiceNotes(item.id, barId);
  const setPrice = useSetDrinkPrice(item.id);
  const setLine = useSetLineService(item.id);
  const setStyle = useSetServiceStyle(item.id);
  const [talkingPoint, setTalkingPoint] = useState(notes.talkingPoint ?? '');
  const [sellItAs, setSellItAs] = useState(notes.sellItAs ?? '');
  const [garnish, setGarnish] = useState(notes.garnish ?? '');
  const [handoff, setHandoff] = useState(handoffText(notes.handoff));
  const [price, setPriceDraft] = useState(item.price ?? '');
  const steps = handoffSteps(handoff).filter((s) => s.trim());
  const tooMany = steps.length > MAX_HANDOFF_STEPS;
  const notesDirty = talkingPoint !== (notes.talkingPoint ?? '') || sellItAs !== (notes.sellItAs ?? '') || garnish !== (notes.garnish ?? '') || handoff !== handoffText(notes.handoff);
  const priceDirty = price !== (item.price ?? '');

  useEffect(() => {
    onPending({
      dirty: notesDirty || priceDirty,
      save: async () => {
        if (tooMany) return false;
        try {
          if (barId && notesDirty) await saveNotes.mutateAsync({ garnish, handoff: steps, talkingPoint, sellItAs });
          if (priceDirty) await setPrice.mutateAsync(price);
          return true;
        } catch {
          return false;
        }
      },
    });
  });

  const lines = specLines(item.recipes as PresentationRecipe[] | undefined);
  const linked = <LinkedTo item={item} onOpen={setOpen} />;
  const { glass, ice } = useDrinkGlass(item);

  return (
    <>
      {barId ? (
        <View style={styles.section}>
          <View style={styles.headRow}>
            <Headline role="heading">For the floor</Headline>
            <Caption tone="muted">Staff only</Caption>
          </View>
          <Field label="Talking point" value={talkingPoint} onChangeText={setTalkingPoint} placeholder="Where it comes from, in a line or two the floor can say." minLines={3} maxLength={1000} />
          <Field label="Sell it as" value={sellItAs} onChangeText={setSellItAs} placeholder="Smoky, spicy, bright. For anyone who likes a whisky sour." multiline maxLength={300} />
          <Caption tone="muted">Employees and up see these. Dietary is worked out from the spec.</Caption>
        </View>
      ) : null}
      {barId ? (
        <View style={styles.section}>
          <Headline role="heading">Service</Headline>
          {lines.length ? (
            <>
              <Caption tone="muted">How it goes out</Caption>
              <ServiceSpec lines={lines} style={isServiceStyle(item.service_style) ? item.service_style : null} showLines canEdit inEditor onSetLine={(key, atService) => setLine.mutate({ key, atService })} onSetStyle={(style) => setStyle.mutate(style)} />
            </>
          ) : null}
          {setLine.error || setStyle.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
          <Field label="Garnish" value={garnish} onChangeText={setGarnish} placeholder="Candied ginger on a pick, laid across the rim." minLines={2} maxLength={500} />
          <Field label="Hand-off" value={handoff} onChangeText={setHandoff} placeholder={'Coaster down first, logo facing the guest\nSay "smoky on top" as it lands'} minLines={3} maxLength={1200} hint={tooMany ? `Up to ${MAX_HANDOFF_STEPS} steps.` : 'One step per line.'} />
          {saveNotes.error ? <Caption tone="accent">{saveNotes.error.message}</Caption> : null}
          <Rows rows={[{ label: 'Glass and ice', value: glass?.name ?? 'No glass yet', hint: 'Its size, the ice per serve and who made them', onPress: () => setOpen('glass') }]} />
          {servicePhotos}
        </View>
      ) : (
        servicePhotos
      )}
      {barId ? <EditPrice itemId={item.id} barId={barId} value={price} onChange={setPriceDraft} /> : null}
      {setPrice.error ? <Caption tone="accent">{"Couldn't save the price. Check your connection and try again."}</Caption> : null}
      {linked}
      {open === 'classic' ? (
        <Sheet visible onClose={() => setOpen(null)} accessibilityLabel="Version of" style={styles.sheet} keyboard>
          <ClassicLink item={item} />
        </Sheet>
      ) : null}
      {open === 'publish' ? (
        <Sheet visible onClose={() => setOpen(null)} accessibilityLabel="Who can see it" style={styles.sheet} header={<Headline role="heading">Who can see it</Headline>}>
          <PublishSection itemId={item.id} barId={barId} mode="edit" />
        </Sheet>
      ) : null}
      {open === 'glass' ? (
        <GlassSheet visible onClose={() => setOpen(null)} itemId={item.id} name={item.name} glass={glass} iceName={ice?.name ?? null} serveMl={item.serve_ml ?? null} icePerServeG={item.ice_per_serve_g ?? null} editing />
      ) : null}
    </>
  );
}

/** Linked to: the classic it's a version of, and who can see it, each a row that opens its sheet. */
function LinkedTo({ item, onOpen }: { item: DatabaseItem; onOpen: (sheet: VenueSheet) => void }) {
  const userId = useUserId();
  const { data: target } = useRankTarget(item.bar_id ? item.id : null);
  const { data: caps = [] } = useCapabilities(item.bar_id);
  const { data: publishing } = useItemPublishing(item.id, item.bar_id);
  const classic = target?.riff_of?.is_catalog ? target.riff_of : null;
  // A riff on a drink outside the catalog has its own family: nothing to link (as ClassicLink).
  const canLink = !!item.bar_id && !!target && !(target.riff_of_id && !classic);
  const canPublish = !!publishing && (item.bar_id ? caps.includes('publish') : !!userId && publishing.createdBy === userId);
  const rows = [
    ...(canLink ? [{ label: 'Version of', value: classic?.name ?? 'Not linked', hint: 'Link it to the classic it is', onPress: () => onOpen('classic') }] : []),
    ...(canPublish ? [{ label: 'Who can see it', value: PUBLISH_COPY[publishing.mode].label, hint: 'Change who can see this drink', onPress: () => onOpen('publish') }] : []),
  ];
  if (!rows.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Linked to</Headline>
      <Rows rows={rows} />
    </View>
  );
}

function Rows({ rows }: { rows: { label: string; value: string; hint: string; onPress: () => void }[] }) {
  const ds = useDs();
  return (
    <View style={[styles.group, { backgroundColor: ds.c.surface }]}>
      {rows.map((r, i) => (
        <PressableScale key={r.label} role="button" accessibilityLabel={`${r.label}: ${r.value}`} accessibilityHint={r.hint} onPress={r.onPress} style={[styles.row, i < rows.length - 1 && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <Body tone="muted" style={styles.label}>
            {r.label}
          </Body>
          <Body numberOfLines={1} style={styles.value}>
            {r.value}
          </Body>
          <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  group: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: 'right' },
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
});
