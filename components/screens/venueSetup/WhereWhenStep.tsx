import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Field, PressableScale, TimeField, useDs, type IconName } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useSaveClaimSetup } from '@/hooks/useBarClaims';
import { useBarFacts, useSaveBarFacts, type BarFactsChange } from '@/hooks/useBarFacts';
import { useSaveProfileInstagram } from '@/hooks/useMyProfile';
import { useProfile, type ProfileClaim } from '@/hooks/useProfiles';
import { WEEK_DAYS, weekRows, type WeekDay, type WeekHours } from '@/lib/barHours';
import { pageInstagram, typedPhone, typedWebsite } from '@/lib/claimVerification';
import { instagramProblem, normalizeInstagram } from '@/lib/profiles';
import { normalizeWebsite } from '@/lib/venueSetup';
import type { HeldSetup } from '@/store/useVenueSetup';

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
function FactRow({ icon, label, children, editing, onEdit, canEdit, editor, last }: { icon: IconName; label: string; children: ReactNode; editing: boolean; onEdit: () => void; canEdit: boolean; editor: ReactNode; last?: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.fact, !last && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.factTop}>
        <IconSymbol name={icon} size={18} color={ds.c.muted} />
        <View style={styles.flex}>
          <Caption tone="muted">{label}</Caption>
          {children}
        </View>
        {canEdit && !editing ? (
          <PressableScale role="button" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} hitSlop={space.sm} style={styles.edit}>
            <IconSymbol name="pencil" size={14} color={ds.c.ink} />
            <Caption style={styles.editLabel}>Edit</Caption>
          </PressableScale>
        ) : null}
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

/** One fact's field, focused as it opens; Return saves it and moves on to the next one (E13). */
function TextEditor({ label, initial, keyboard, onSave, onCancel }: { label: string; initial: string; keyboard: 'phone-pad' | 'url'; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <View style={styles.editor}>
      <Field label={label} value={value} onChangeText={setValue} keyboardType={keyboard} autoCapitalize="none" autoCorrect={false} autoFocus returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => onSave(value)} />
      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
        <Button label="Save" onPress={() => onSave(value)} />
      </View>
    </View>
  );
}

/** A change to keep with the setup: checked here, since nothing else checks it until the claim goes. */
function heldProblem(change: BarFactsChange): string | null {
  if (change.phone && !typedPhone(change.phone)) return 'That phone number doesn’t look right.';
  if (change.website && !typedWebsite(change.website)) return 'That website doesn’t look right.';
  return null;
}

interface Props {
  profileId: string | null;
  name: string;
  claim: ProfileClaim | null;
  writable: boolean;
  /** Typed before there's a claim, kept with the setup. */
  held: HeldSetup | undefined;
  onHold: (change: HeldSetup) => void;
  /** Making the venue as this step finishes failed. */
  venueError?: string | null;
  making?: boolean;
  onDone: () => void;
}

/**
 * Step 3: address, hours, phone, website and Instagram, typed by the venue
 * (b22: no Google). Once the page is the venue's, edits go straight onto it;
 * while a claim waits they wait on the claim (save_claim_setup); before
 * there's a claim they're kept with the setup and go onto the claim when it's
 * sent (the last step).
 */
export function WhereWhenStep({ profileId, name, claim, writable, held: kept, onHold, venueError, making, onDone }: Props) {
  const ds = useDs();
  const facts = useBarFacts(profileId).data;
  const profile = useProfile(profileId).data;
  const saveFacts = useSaveBarFacts(profileId ?? '');
  const saveSetup = useSaveClaimSetup();
  const saveInstagram = useSaveProfileInstagram();
  const [editing, setEditing] = useState<'hours' | 'phone' | 'website' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ig, setIg] = useState<string | null>(null);
  const igField = useRef<ComponentRef<typeof TextInput>>(null);
  const [now] = useState(() => new Date());
  const pending = !writable && claim?.status === 'pending';
  const holding = !writable && !pending;
  const held: HeldSetup = pending ? (claim?.setup ?? {}) : holding ? (kept ?? {}) : {};
  // A held null is a cleared field, not a missing one.
  const hours = held.hours !== undefined ? (held.hours as WeekHours | null) : (facts?.hours ?? null);
  const phone = held.phone !== undefined ? held.phone : (facts?.phone ?? null);
  const website = held.website !== undefined ? held.website : (facts?.website ?? null);
  const pageIg = profile ? pageInstagram(profile) : null;
  // A waiting claim's Instagram (typed into it, else kept from setup) goes on only where the page has none.
  const instagram = ig ?? (pending ? (pageIg ?? claim?.evidence?.typed?.instagram ?? claim?.setup?.instagram) : holding ? (kept?.instagram ?? pageIg) : pageIg) ?? '';
  const igProblem = instagramProblem(instagram);
  const error = problem ?? (saveFacts.error ?? saveSetup.error ?? saveInstagram.error)?.message ?? venueError ?? null;

  // Saved: close the editor, or open the next field (Return: phone, then website, then Instagram).
  const advance = (next?: 'website' | 'instagram') => {
    setEditing(next === 'website' ? 'website' : null);
    if (next === 'instagram') igField.current?.focus();
  };
  const save = (change: BarFactsChange, next?: 'website' | 'instagram') => {
    const withZone = change.hours && !facts?.timezone ? { ...change, timezone: deviceZone() } : change;
    const done = { onSuccess: () => advance(next) };
    setProblem(null);
    if (writable) saveFacts.mutate(withZone, done);
    else if (pending && claim) saveSetup.mutate({ claimId: claim.id, setup: withZone as Parameters<typeof saveSetup.mutate>[0]['setup'] }, done);
    else {
      const wrong = heldProblem(withZone);
      if (wrong) return setProblem(wrong);
      onHold(withZone as HeldSetup);
      advance(next);
    }
  };
  const looksRight = () => {
    if (ig === null || pending) return onDone();
    // The field shows what's wrong.
    if (igProblem) return;
    if (writable && profileId) return saveInstagram.mutate({ id: profileId, raw: ig }, { onSuccess: onDone });
    onHold({ instagram: normalizeInstagram(ig) || null });
    onDone();
  };
  const address = facts ? [facts.address_line, facts.locality ?? facts.city].filter(Boolean).join(', ') : '';

  return (
    <SetupPage footer={<SetupFooter label="Looks right" pending={saveInstagram.isPending || making} onPress={looksRight} skipLabel="Skip" onSkip={onDone} />}>
      {/* The facts in one card (canvas make-venue-place, and the Instagram row from eddie-oct22-wave1). */}
      <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <FactRow icon="mappin.and.ellipse" label="Address" canEdit={false} editing={false} onEdit={() => {}} editor={null}>
        <Body>{address || 'No address yet'}</Body>
      </FactRow>
      <FactRow icon="clock" label="Hours" canEdit editing={editing === 'hours'} onEdit={() => setEditing('hours')} editor={<HoursEditor initial={hours ?? {}} onSave={(h) => save({ hours: h })} onCancel={() => setEditing(null)} />}>
        {hours ? (
          <View role="list">
            {weekRows(hours, now, facts?.timezone).map((r) => (
              <View key={r.day} role="listitem" style={styles.hoursRow}>
                <Body tone="muted" style={styles.dayName}>{r.day.slice(0, 3)}</Body>
                <Body tone={r.closed ? 'muted' : 'ink'}>{r.text}</Body>
              </View>
            ))}
          </View>
        ) : (
          <Body tone="muted">Not added yet</Body>
        )}
      </FactRow>
      <FactRow icon="phone" label="Phone" canEdit editing={editing === 'phone'} onEdit={() => setEditing('phone')} editor={<TextEditor label="Phone" initial={phone ?? ''} keyboard="phone-pad" onSave={(v) => save({ phone: v.trim() || null }, 'website')} onCancel={() => setEditing(null)} />}>
        <Body tone={phone ? 'ink' : 'muted'}>{phone ?? 'Not added yet'}</Body>
      </FactRow>
      <FactRow icon="globe" label="Website" canEdit editing={editing === 'website'} onEdit={() => setEditing('website')} editor={<TextEditor label="Website" initial={website ?? ''} keyboard="url" onSave={(v) => save({ website: normalizeWebsite(v) }, 'instagram')} onCancel={() => setEditing(null)} />}>
        <Body tone={website ? 'ink' : 'muted'}>{website ?? 'Not added yet'}</Body>
      </FactRow>
      <View style={styles.fact}>
        <View style={styles.factTop}>
          <IconSymbol name="camera" size={18} color={ds.c.muted} />
          <View style={styles.flex}>
            {pending ? (
              <>
                <Caption tone="muted">Instagram</Caption>
                <Body tone={instagram ? 'ink' : 'muted'}>{instagram ? `@${instagram}` : 'Not added yet'}</Body>
              </>
            ) : (
              // The @ sits in the box (E10), so a typed or pasted one is dropped: the handle is kept without it.
              <Field ref={igField} label="Instagram" prefix="@" value={instagram.replace(/^@+/, '')} onChangeText={(t) => { setIg(t.replace(/^@+/, '')); setProblem(null); }} placeholder="littlerye" autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={60} returnKeyType="done" error={ig !== null ? igProblem : undefined} />
            )}
          </View>
        </View>
      </View>
      </View>
      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}
      <Caption tone="muted">
        {pending
          ? 'These wait on your claim and go on your page when it’s approved. The address stays as it is; tell us in the claim if it’s wrong.'
          : writable
            ? 'Change any of it later in Venue settings.'
            : `Kept with your setup. They go on ${name}’s page once we’ve checked it’s yours (the last step).`}
      </Caption>
      {/* No role step for whoever sets the bar up (owner-setup call 4): one line says it. */}
      <View style={[styles.admin, { backgroundColor: ds.c.raised }]}>
        <DsText variant="body" style={styles.editLabel}>You’re the Admin</DsText>
        <Caption tone="muted">The owner can do everything here, and can hand it over later in My team.</Caption>
      </View>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  fact: { paddingVertical: space.lg, gap: space.md },
  edit: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 24 },
  editLabel: { fontFamily: fontFamilies.bodySemiBold },
  factTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  editor: { gap: space.md },
  day: { gap: space.sm },
  dayName: { width: 48 },
  times: { flexDirection: 'row', gap: space.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  hoursRow: { flexDirection: 'row', gap: space.md },
  admin: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
