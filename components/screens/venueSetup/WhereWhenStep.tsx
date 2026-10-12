import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Field, TimeField, useDs, type IconName } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useSaveClaimSetup } from '@/hooks/useBarClaims';
import { useBarFacts, useSaveBarFacts, type BarFactsChange } from '@/hooks/useBarFacts';
import type { ProfileClaim } from '@/hooks/useProfiles';
import { WEEK_DAYS, weekRows, type WeekDay, type WeekHours } from '@/lib/barHours';
import { normalizeWebsite } from '@/lib/venueSetup';

const DAY: Record<WeekDay, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

/** The device's zone, saved with the hours so "Open now" runs on the bar's clock. */
function deviceZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** One fact: an icon, its label and value, and Edit (which opens its editor in place). */
function FactRow({ icon, label, children, editing, onEdit, canEdit, editor }: { icon: IconName; label: string; children: ReactNode; editing: boolean; onEdit: () => void; canEdit: boolean; editor: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.fact, { borderBottomColor: ds.c.line }]}>
      <View style={styles.factTop}>
        <IconSymbol name={icon} size={20} color={ds.c.muted} />
        <View style={styles.flex}>
          <Caption tone="muted">{label}</Caption>
          {children}
        </View>
        {canEdit && !editing ? <Button label="Edit" variant="ghost" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} /> : null}
      </View>
      {editing ? editor : null}
    </View>
  );
}

/** A week of hours, one range a day. ponytail: two ranges a day (lunch and dinner) live in Venue settings. */
function HoursEditor({ initial, onSave, onCancel }: { initial: WeekHours; onSave: (h: WeekHours) => void; onCancel: () => void }) {
  const [hours, setHours] = useState<WeekHours>(initial);
  const set = (day: WeekDay, range: [string, string] | null) => setHours((h) => ({ ...h, [day]: range ? [range] : [] }));
  return (
    <View style={styles.editor}>
      {WEEK_DAYS.map((day) => {
        const range = hours[day]?.[0] ?? null;
        return (
          <View key={day} style={styles.day}>
            <DsText variant="headline" style={styles.dayName}>{DAY[day]}</DsText>
            <Chip multi label={range ? 'Open' : 'Closed'} accessibilityLabel={`Open on ${DAY[day]}`} selected={!!range} onPress={() => set(day, range ? null : ['17:00', '00:00'])} />
            {range ? (
              <View style={styles.times}>
                <View style={styles.flex}>
                  <TimeField label="Opens" value={range[0]} onChange={(t) => set(day, [t, range[1]])} />
                </View>
                <View style={styles.flex}>
                  <TimeField label="Closes" value={range[1]} onChange={(t) => set(day, [range[0], t])} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
        <Button label="Save hours" onPress={() => onSave(hours)} />
      </View>
    </View>
  );
}

function TextEditor({ label, initial, keyboard, onSave, onCancel }: { label: string; initial: string; keyboard: 'phone-pad' | 'url'; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <View style={styles.editor}>
      <Field label={label} value={value} onChangeText={setValue} keyboardType={keyboard} autoCapitalize="none" autoCorrect={false} />
      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
        <Button label="Save" onPress={() => onSave(value)} />
      </View>
    </View>
  );
}

/**
 * Step 4: address, hours, phone and website, typed by the venue (b22: no
 * Google). Once the page is the venue's, edits go straight onto it; while the
 * claim waits they wait on the claim (save_claim_setup) and go on at approval.
 */
export function WhereWhenStep({ profileId, claim, writable, onDone }: { profileId: string | null; claim: ProfileClaim | null; writable: boolean; onDone: () => void }) {
  const facts = useBarFacts(profileId).data;
  const saveFacts = useSaveBarFacts(profileId ?? '');
  const saveSetup = useSaveClaimSetup();
  const [editing, setEditing] = useState<'hours' | 'phone' | 'website' | null>(null);
  const [now] = useState(() => new Date());
  const pending = !writable && claim?.status === 'pending';
  const held = pending ? (claim?.setup ?? {}) : {};
  const hours = (held.hours as WeekHours | undefined) ?? facts?.hours ?? null;
  const phone = held.phone ?? facts?.phone ?? null;
  const website = held.website ?? facts?.website ?? null;
  const canEdit = writable || pending;
  const error = saveFacts.error ?? saveSetup.error;

  const save = (change: BarFactsChange) => {
    const withZone = change.hours && !facts?.timezone ? { ...change, timezone: deviceZone() } : change;
    const done = { onSuccess: () => setEditing(null) };
    if (writable) saveFacts.mutate(withZone, done);
    else if (pending && claim) saveSetup.mutate({ claimId: claim.id, setup: withZone as Parameters<typeof saveSetup.mutate>[0]['setup'] }, done);
  };
  const address = facts ? [facts.address_line, facts.locality ?? facts.city].filter(Boolean).join(', ') : '';

  return (
    <SetupPage footer={<SetupFooter label="Looks right" onPress={onDone} onSkip={onDone} />}>
      <FactRow icon="mappin.and.ellipse" label="Address" canEdit={false} editing={false} onEdit={() => {}} editor={null}>
        <Body>{address || 'No address yet'}</Body>
      </FactRow>
      <FactRow icon="clock.arrow.circlepath" label="Hours" canEdit={canEdit} editing={editing === 'hours'} onEdit={() => setEditing('hours')} editor={<HoursEditor initial={hours ?? {}} onSave={(h) => save({ hours: h })} onCancel={() => setEditing(null)} />}>
        {hours ? (
          <View role="list">
            {weekRows(hours, now, facts?.timezone).map((r) => (
              <View key={r.day} role="listitem" style={styles.hoursRow}>
                <Body style={styles.dayName}>{r.day.slice(0, 3)}</Body>
                <Body tone={r.closed ? 'muted' : 'ink'}>{r.text}</Body>
              </View>
            ))}
          </View>
        ) : (
          <Body tone="muted">Not added yet</Body>
        )}
      </FactRow>
      <FactRow icon="building.2" label="Phone" canEdit={canEdit} editing={editing === 'phone'} onEdit={() => setEditing('phone')} editor={<TextEditor label="Phone" initial={phone ?? ''} keyboard="phone-pad" onSave={(v) => save({ phone: v.trim() || null })} onCancel={() => setEditing(null)} />}>
        <Body tone={phone ? 'ink' : 'muted'}>{phone ?? 'Not added yet'}</Body>
      </FactRow>
      <FactRow icon="globe" label="Website" canEdit={canEdit} editing={editing === 'website'} onEdit={() => setEditing('website')} editor={<TextEditor label="Website" initial={website ?? ''} keyboard="url" onSave={(v) => save({ website: normalizeWebsite(v) })} onCancel={() => setEditing(null)} />}>
        <Body tone={website ? 'ink' : 'muted'}>{website ?? 'Not added yet'}</Body>
      </FactRow>
      {error ? (
        <Caption tone="accent" role="alert">
          {error.message}
        </Caption>
      ) : null}
      <Caption tone="muted">
        {pending
          ? 'These wait on your claim and go on your page when it’s approved. The address stays as it is; tell us in the claim if it’s wrong.'
          : writable
            ? 'Change any of it later in Venue settings.'
            : 'Claim your bar’s page to add these. Everything else here still works.'}
      </Caption>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  fact: { paddingVertical: space.md, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  factTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  editor: { gap: space.md },
  day: { gap: space.sm },
  dayName: { width: 48 },
  times: { flexDirection: 'row', gap: space.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  hoursRow: { flexDirection: 'row', gap: space.md },
});
