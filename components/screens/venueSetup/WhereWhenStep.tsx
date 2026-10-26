import { getLocales } from 'expo-localization';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, DsText, Field, PressableScale, useDs, type IconName } from '@/components/ds';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useSaveClaimSetup } from '@/hooks/useBarClaims';
import { useBarFacts, useSaveBarFacts, type BarFactsChange } from '@/hooks/useBarFacts';
import { useSaveProfileInstagram } from '@/hooks/useMyProfile';
import { usePricingSettings } from '@/hooks/usePricing';
import { useProfile, type ProfileClaim } from '@/hooks/useProfiles';
import type { WeekHours } from '@/lib/barHours';
import { pageInstagram, typedPhone, typedWebsite } from '@/lib/claimVerification';
import { countryName } from '@/lib/countries';
import { weekGroups } from '@/lib/hoursWeek';
import { currencyFor, currencyLabel } from '@/lib/money';
import { instagramProblem, normalizeInstagram } from '@/lib/profiles';
import { normalizeWebsite } from '@/lib/venueSetup';
import type { HeldSetup } from '@/store/useVenueSetup';

import { CurrencyPicker } from './CurrencyPicker';
import { HoursSheet } from './HoursSheet';

/** The device's zone, saved with the hours so "Open now" runs on the bar's clock. */
function deviceZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** One fact: an icon, its label and value, and Edit (which opens its editor in place; `done` closes it again). */
function FactRow({ icon, label, children, editing, onEdit, canEdit, editor, last, action = 'Edit', done }: { icon: IconName; label: string; children: ReactNode; editing: boolean; onEdit: () => void; canEdit: boolean; editor: ReactNode; last?: boolean; action?: string; done?: () => void }) {
  const ds = useDs();
  const button = editing ? (done ? 'Done' : null) : canEdit ? action : null;
  return (
    <View style={[styles.fact, !last && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.factTop}>
        <IconSymbol name={icon} size={18} color={ds.c.muted} />
        <View style={styles.flex}>
          <Caption tone="muted">{label}</Caption>
          {children}
        </View>
        {button ? (
          <PressableScale role="button" accessibilityLabel={`${button} ${label.toLowerCase()}`} onPress={editing ? done : onEdit} hitSlop={space.sm} style={styles.edit}>
            {button === 'Edit' ? <IconSymbol name="pencil" size={14} color={ds.c.ink} /> : null}
            <Caption color={button === 'Edit' ? ds.c.ink : ds.accentText} style={styles.editLabel}>{button}</Caption>
          </PressableScale>
        ) : null}
      </View>
      {editing ? editor : null}
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
  /** The venue, once it's made: its currency may already be set in Pricing. */
  barId: string | null;
  name: string;
  claim: ProfileClaim | null;
  writable: boolean;
  /** Typed before there's a claim, kept with the setup. */
  held: HeldSetup | undefined;
  onHold: (change: HeldSetup) => void;
  /** Making the venue as this step finishes failed. */
  venueError?: string | null;
  making?: boolean;
  /** `currency`: the one to save onto the venue as it's made, when it isn't its currency already. */
  onDone: (currency: string | null) => void;
}

/**
 * Step 3: address, hours, phone, website and Instagram, typed by the venue
 * (b22: no Google). Once the page is the venue's, edits go straight onto it;
 * while a claim waits they wait on the claim (save_claim_setup); before
 * there's a claim they're kept with the setup and go onto the claim when it's
 * sent (the last step). The currency is asked here too (E28b) and saved onto
 * the venue as this step makes it, the same bars.currency Pricing edits.
 */
export function WhereWhenStep({ profileId, barId, name, claim, writable, held: kept, onHold, venueError, making, onDone }: Props) {
  const ds = useDs();
  const facts = useBarFacts(profileId).data;
  const profile = useProfile(profileId).data;
  const saveFacts = useSaveBarFacts(profileId ?? '');
  const saveSetup = useSaveClaimSetup();
  const saveInstagram = useSaveProfileInstagram();
  const [editing, setEditing] = useState<'hours' | 'currency' | 'phone' | 'website' | null>(null);
  // Each time the Hours sheet opens it starts from the saved hours.
  const [hoursKey, setHoursKey] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [ig, setIg] = useState<string | null>(null);
  const igField = useRef<ComponentRef<typeof TextInput>>(null);
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
  // The currency: the venue's own (Pricing), else its country's, else this phone's, which needs a look (E28b).
  const setCurrency = usePricingSettings(barId).data?.currency ?? null;
  const country = profile?.country_code ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const fromCountry = currencyFor({ country });
  const currency = picked ?? currencyFor({ set: setCurrency, country, device: getLocales()[0]?.currencyCode });
  const place = [facts?.locality ?? facts?.city, country ? countryName(country) : null].filter(Boolean).join(', ');
  const fromPhone = !picked && currency !== null && currency !== setCurrency && !fromCountry;
  const currencySource = picked ? null : currency === setCurrency && setCurrency ? 'Set in Venue settings › Pricing' : fromCountry ? `From the address${place ? `: ${place}` : ''}` : fromPhone ? 'From this phone, as there’s no address. Check it’s right.' : null;
  const finish = () => onDone(currency && currency !== setCurrency ? currency : null);
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
    // No address, so the currency is only the phone's guess: look at it first (E28b).
    if (fromPhone && !checked) {
      setChecked(true);
      setEditing('currency');
      return setProblem('Check the currency: it’s this phone’s, as there’s no address.');
    }
    if (ig === null || pending) return finish();
    // The field shows what's wrong.
    if (igProblem) return;
    if (writable && profileId) return saveInstagram.mutate({ id: profileId, raw: ig }, { onSuccess: finish });
    onHold({ instagram: normalizeInstagram(ig) || null });
    finish();
  };
  const address = facts ? [facts.address_line, facts.locality ?? facts.city].filter(Boolean).join(', ') : '';

  return (
    <SetupPage footer={<SetupFooter label="Looks right" pending={saveInstagram.isPending || making} onPress={looksRight} skipLabel="Skip" onSkip={() => onDone(null)} />}>
      {/* The facts in one card (canvas make-venue-place, and the Instagram row from eddie-oct22-wave1). */}
      <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <FactRow icon="mappin.and.ellipse" label="Address" canEdit={false} editing={false} onEdit={() => {}} editor={null}>
        <Body>{address || 'No address yet'}</Body>
      </FactRow>
      <FactRow
        icon="dollarsign.circle.fill"
        label="Currency"
        canEdit
        action="Change"
        editing={editing === 'currency'}
        onEdit={() => setEditing('currency')}
        done={() => {
          setChecked(true);
          setProblem(null);
          setEditing(null);
        }}
        editor={<CurrencyPicker value={currency} first={fromCountry} onPick={(c) => { setPicked(c); setChecked(true); setProblem(null); }} />}
      >
        <Body tone={currency ? 'ink' : 'muted'}>{currency ? currencyLabel(currency) : 'Not set yet'}</Body>
        {currencySource ? <Caption tone="muted">{currencySource}</Caption> : null}
      </FactRow>
      <FactRow
        icon="clock"
        label="Hours"
        canEdit
        action="Change"
        editing={false}
        onEdit={() => {
          setHoursKey((k) => k + 1);
          setEditing('hours');
        }}
        editor={null}
      >
        {hours && weekGroups(hours).some((g) => !g.closed) ? (
          <View role="list" style={styles.groups}>
            {weekGroups(hours).map((g) => (
              <View key={g.days} role="listitem">
                <Body style={styles.editLabel}>{g.days}</Body>
                <Caption tone="muted">{g.text}</Caption>
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
      <HoursSheet
        key={hoursKey}
        visible={editing === 'hours'}
        initial={hours}
        saving={saveFacts.isPending || saveSetup.isPending}
        error={(saveFacts.error ?? saveSetup.error)?.message ?? problem}
        onSave={(h) => save({ hours: h })}
        onClose={() => setEditing(null)}
      />
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  groups: { gap: space.sm },
  admin: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
