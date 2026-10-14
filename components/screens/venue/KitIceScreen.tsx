import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { Body, Button, Caption, Chip, Field, PressableScale, Sheet, SheetScrollView, Surface, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarKit, useRemoveKit, useSaveKit, type KitRow } from '@/hooks/useBarKit';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useVenueSuppliers } from '@/hooks/useVenueSuppliers';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { ICE_KINDS, ICE_LABEL, kitSourceLine, type IceKind } from '@/lib/venueKit';

import { VenueSubPage } from './VenueSubPage';

const FAILED = 'Couldn’t save that. Check your connection and try again.';

/** Kit: Ice. The ice a venue pours, each made here or from one of its suppliers. Anyone with Prep changes it. */
export function KitIceScreen({ barId }: { barId: string }) {
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const canEdit = (useCapabilities(barId).data ?? []).includes('prep');
  const { data: kit = [], isLoading, error } = useBarKit(barId);
  const save = useSaveKit(barId);
  const [open, setOpen] = useState<KitRow | null>(null);
  const ices = kit.filter((r) => r.kind === 'ice');
  const missing = ICE_KINDS.filter((k) => !ices.some((r) => r.key === k));

  return (
    <VenueSubPage barId={barId} title="Ice" intro={`The ice ${venue?.name ?? 'the venue'} pours with. The drink wizard offers these first, and each drink is drawn with its own.`}>
      {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
      {error ? <Body tone="muted">Couldn’t load the ice. Check your connection and try again.</Body> : null}
      {ices.length ? (
        <Surface style={styles.list}>
          <View role="list">
            {ices.map((r, i) => (
              <IceRow key={r.id} row={r} first={i === 0} onOpen={canEdit ? () => setOpen(r) : undefined} />
            ))}
          </View>
        </Surface>
      ) : !isLoading && !error ? (
        <Body tone="muted">No ice listed yet.</Body>
      ) : null}
      {canEdit && missing.length ? (
        <View style={styles.group}>
          <Caption tone="muted">{ices.length ? 'Add another kind' : 'Add the ice you pour'}</Caption>
          <View style={styles.chips}>
            {missing.map((k) => (
              <Chip key={k} label={ICE_LABEL[k]} selected={false} multi accessibilityLabel={`Add ${ICE_LABEL[k]}`} onPress={() => save.mutate({ kind: 'ice', key: k })} />
            ))}
          </View>
          {save.error && !open ? <Caption tone="accent">{FAILED}</Caption> : null}
        </View>
      ) : null}
      {!canEdit ? <Caption tone="muted">You can look, but changing the kit needs Prep at this venue.</Caption> : null}
      <IceSheet barId={barId} row={open} onClose={() => setOpen(null)} />
    </VenueSubPage>
  );
}

const EMPTY = draftSketchInputs({ name: '', lines: [] });

/** The ice, drawn in an empty glass: a spear in a highball, the rest in a rocks glass. */
function IceDrawing({ kind }: { kind: IceKind }) {
  const ds = useDs();
  const inputs = useMemo(() => ({ ...EMPTY, glass: kind === 'spear' ? ('highball' as const) : ('rocks' as const), variant: null, ice: kind }), [kind]);
  return (
    <View style={[styles.paper, { backgroundColor: ds.c.paper }]} aria-hidden>
      <SketchDrawing inputs={inputs} seed={`bar-ice-${kind}`} detail="thumb" />
    </View>
  );
}

function IceRow({ row, first, onOpen }: { row: KitRow; first: boolean; onOpen?: () => void }) {
  const ds = useDs();
  const label = ICE_LABEL[row.key as IceKind] ?? row.key;
  const source = kitSourceLine(row);
  const body = (
    <>
      <IceDrawing kind={row.key as IceKind} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{label}</Body>
        {source ? (
          <Caption tone="muted" numberOfLines={2}>
            {source}
          </Caption>
        ) : null}
      </View>
    </>
  );
  const style = [styles.row, first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }];
  return (
    <View role="listitem" style={style}>
      {onOpen ? (
        <PressableScale role="button" accessibilityLabel={`Change ${label}${source ? `. ${source}` : ''}`} onPress={onOpen} style={[styles.row, styles.flex]}>
          {body}
        </PressableScale>
      ) : (
        body
      )}
    </View>
  );
}

/** One kind of ice, opened: a note, and made here or from a supplier. */
function IceSheet({ barId, row, onClose }: { barId: string; row: KitRow | null; onClose: () => void }) {
  return (
    <Sheet visible={!!row} onClose={onClose} accessibilityLabel={row ? ICE_LABEL[row.key as IceKind] : 'Ice'} keyboard>
      {row ? <IceForm key={row.id} barId={barId} row={row} onDone={onClose} /> : null}
    </Sheet>
  );
}

type Source = 'here' | 'none' | string;

function IceForm({ barId, row, onDone }: { barId: string; row: KitRow; onDone: () => void }) {
  const suppliers = useVenueSuppliers(barId).data ?? [];
  const save = useSaveKit(barId);
  const remove = useRemoveKit(barId);
  const [note, setNote] = useState(row.note ?? '');
  const [source, setSource] = useState<Source>(row.made_here ? 'here' : (row.supplier_id ?? 'none'));
  const options = [{ id: 'here', label: 'Made here' }, ...suppliers.map((s) => ({ id: s.id, label: s.name })), { id: 'none', label: 'Not said' }];
  const done = { onSuccess: onDone };
  return (
    <SheetScrollView contentContainerStyle={styles.sheet}>
      <Title>{ICE_LABEL[row.key as IceKind] ?? row.key}</Title>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Hoshizaki under the well" maxLength={120} />
      <View style={styles.group}>
        <Caption tone="muted">Where it comes from</Caption>
        <View role="radiogroup" accessibilityLabel="Where it comes from" style={styles.chips}>
          {options.map((o) => (
            <Chip key={o.id} label={o.label} selected={source === o.id} onPress={() => setSource(o.id)} />
          ))}
        </View>
      </View>
      {save.error || remove.error ? <Caption tone="accent">{FAILED}</Caption> : null}
      <View style={styles.actions}>
        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          disabled={save.isPending || remove.isPending}
          onPress={() => save.mutate({ id: row.id, kind: 'ice', key: row.key, note: note.trim() || null, made_here: source === 'here', supplier_id: source === 'here' || source === 'none' ? null : source }, done)}
        />
        <Button label="Remove" variant="ghost" disabled={save.isPending || remove.isPending} onPress={() => remove.mutate(row.id, done)} />
      </View>
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
  paper: { width: 48, height: 48, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sheet: { gap: space.lg, padding: space.lg },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
