import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, useGutter, useToast } from '@/components/ds';
import { SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useCancelVenueDelete, useVenueDeleteRequest } from '@/hooks/useDeleteVenue';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { withAlpha } from '@/lib/color';
import { askedBy, deleteDay } from '@/lib/venueDelete';

import { DeleteVenueSheet } from './DeleteVenueSheet';

const ADMIN = 40;

/**
 * Venue settings' last section, for the venue's Admins only (E53): a red
 * Delete row that opens the two steps, or once it's asked for, the day it
 * goes and Undo. Other roles never see it.
 */
export function DeleteVenueSection({ barId, name }: { barId: string; name: string }) {
  const meId = useUserId();
  const admin = useEffectiveRole(barId) >= ADMIN;
  const request = useVenueDeleteRequest(admin ? barId : null).data;
  const members = useBarMembers(request ? barId : null).data ?? [];
  const undo = useUndo(barId, name, request?.requested_by ?? null);
  const [open, setOpen] = useState(false);
  if (!admin) return null;

  return (
    <SettingsSection title="Delete this bar" note="Only Admins see this.">
      {request ? (
        <View style={styles.asked}>
          <View style={styles.line}>
            <IconSymbol name="clock" size={18} color={STATUS.danger} />
            <View style={styles.flex}>
              <DsText variant="headline" color={STATUS.danger}>{`Deleting on ${deleteDay(request.deletes_at)}`}</DsText>
              <Caption tone="muted">{`${askedBy(request.requested_by, meId, members)} asked on ${deleteDay(request.requested_at)}. Everything works until then.`}</Caption>
            </View>
          </View>
          <Button label={`Undo, keep ${name}`} variant="secondary" size="sm" icon="arrow.uturn.backward" disabled={undo.isPending} onPress={undo.run} />
          {undo.error ? (
            <Caption tone="accent" role="alert">
              {undo.error}
            </Caption>
          ) : null}
        </View>
      ) : (
        <SettingsRow icon="trash" tone="danger" label={`Delete ${name}`} detail="For your whole team, after 7 days. Its public page stays." onPress={() => setOpen(true)} />
      )}
      <DeleteVenueSheet barId={barId} name={name} visible={open} onClose={() => setOpen(false)} />
    </SettingsSection>
  );
}

/**
 * At the top of every venue screen for the 7 days, for the whole team, and
 * it can't be dismissed (E53): who asked and the day. Admins get Undo and
 * What goes; everyone else is told to ask an Admin. In ScreenHeader, so every
 * venue tab has it.
 */
export function VenueDeleteBanner() {
  const gutter = useGutter();
  const meId = useUserId();
  const { mode } = useMode();
  const venue = useActiveVenue().active;
  const barId = mode === 'venue' ? (venue?.id ?? null) : null;
  const admin = useEffectiveRole(barId) >= ADMIN;
  const request = useVenueDeleteRequest(barId).data;
  const members = useBarMembers(request ? barId : null).data ?? [];
  const name = venue?.name ?? 'This venue';
  const undo = useUndo(barId, name, request?.requested_by ?? null);
  const [look, setLook] = useState(false);
  if (!barId || !request) return null;
  const who = askedBy(request.requested_by, meId, members);
  const day = deleteDay(request.deletes_at);

  return (
    <View style={{ paddingHorizontal: gutter, paddingTop: space.md }}>
      <View role="alert" style={[styles.banner, { backgroundColor: withAlpha(STATUS.danger, 0.1), borderColor: withAlpha(STATUS.danger, 0.45) }]}>
        <View style={styles.line}>
          <IconSymbol name="exclamationmark.triangle" size={18} color={STATUS.danger} style={styles.icon} />
          <View style={styles.flex}>
            <Body style={styles.strong}>{`${who} asked to delete ${name}`}</Body>
            <Caption>{admin ? `It goes on ${day}. Until then everything works as normal.` : `It goes on ${day}. If that’s a mistake, ask an Admin to undo it.`}</Caption>
          </View>
        </View>
        {admin ? (
          <View style={styles.actions}>
            <Button label={`Undo, keep ${name}`} variant="secondary" size="sm" icon="arrow.uturn.backward" disabled={undo.isPending} onPress={undo.run} />
            <Button label="What goes" variant="secondary" size="sm" onPress={() => setLook(true)} />
          </View>
        ) : null}
        {undo.error ? (
          <Caption tone="accent" role="alert">
            {undo.error}
          </Caption>
        ) : null}
      </View>
      {admin ? <DeleteVenueSheet barId={barId} name={name} visible={look} onClose={() => setLook(false)} look /> : null}
    </View>
  );
}

/** Undo for any Admin, then a toast: "Little Rye stays. Kevin's request is cancelled." */
function useUndo(barId: string | null, name: string, requestedBy: string | null) {
  const meId = useUserId();
  const toast = useToast();
  const cancel = useCancelVenueDelete();
  const members = useBarMembers(requestedBy ? barId : null).data ?? [];
  const who = askedBy(requestedBy, meId, members);
  return {
    isPending: cancel.isPending,
    error: cancel.error ? 'Couldn’t undo it. Check your connection and try again.' : null,
    run: () =>
      barId &&
      cancel.mutate(barId, {
        onSuccess: () => toast.show({ title: `${name} stays. ${who === 'You' ? 'Your' : `${who.split(' ')[0]}’s`} request is cancelled.` }),
      }),
  };
}

const styles = StyleSheet.create({
  asked: { gap: space.md, paddingVertical: space.sm },
  banner: { gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  icon: { marginTop: 2 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
