import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, DsText, Field, GlassButton, Sheet, sheetIsDialog, SheetScrollView, Title, useBreakpoint, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useDeleteVenue } from '@/hooks/useDeleteVenue';
import { withAlpha } from '@/lib/color';
import { deleteDay, nameMatches, otherAdmins, STAYS_NOTE, whatGoes, whatStays } from '@/lib/venueDelete';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Delete this bar's two steps (board w3-delete-bar): what goes and what
 * stays, then the bar's name typed back and Delete in 7 days. A centred
 * dialog on wide screens (Sheet). `look`: the lists alone, with Close, for
 * the banner's What goes.
 */
export function DeleteVenueSheet({ barId, name, visible, onClose, look }: { barId: string; name: string; visible: boolean; onClose: () => void; look?: boolean }) {
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={`Delete ${name}?`} keyboard style={styles.sheet}>
      <Steps barId={barId} name={name} look={look} />
    </Sheet>
  );
}

function Steps({ barId, name, look }: { barId: string; name: string; look?: boolean }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const close = useSheetClose();
  const meId = useUserId();
  const members = useBarMembers(barId).data ?? [];
  const remove = useDeleteVenue();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [now] = useState(() => Date.now());
  const matches = nameMatches(typed, name);
  const others = otherAdmins(meId, members);
  // Wide screens' dialog puts its buttons side by side; a phone stacks them.
  const side = useBreakpoint() !== 'phone' && sheetIsDialog;

  return (
    <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <Title style={styles.flex}>{look ? `What goes with ${name}` : `Delete ${name}?`}</Title>
        <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} />
      </View>
      {step === 1 ? (
        <>
          <Caption tone="muted">{look ? 'Nothing goes until the day it’s set for, and any Admin can undo it until then.' : 'Step 1 of 2. Nothing goes for 7 days, and any Admin can undo it until then.'}</Caption>
          <View style={[styles.box, { backgroundColor: withAlpha(STATUS.danger, 0.1), borderColor: withAlpha(STATUS.danger, 0.4) }]}>
            <DsText variant="label" color={STATUS.danger} style={styles.cap}>
              Goes
            </DsText>
            {whatGoes(name, members.length || undefined).map((line) => (
              <Line key={line} icon="xmark" color={STATUS.danger} text={line} />
            ))}
          </View>
          <View style={[styles.box, { backgroundColor: ds.c.raised, borderColor: 'transparent' }]}>
            <DsText variant="label" color={STATUS.success} style={styles.cap}>
              {`Stays on ${name}’s public page`}
            </DsText>
            {whatStays(name).map((line) => (
              <Line key={line} icon="checkmark" color={STATUS.success} text={line} />
            ))}
          </View>
          <Caption tone="muted">{STAYS_NOTE}</Caption>
          {look ? (
            <Button label="Close" variant="secondary" onPress={close} />
          ) : (
            <View style={[styles.actions, side ? styles.dialogActions : null]}>
              <Button label="Next" variant="danger" onPress={() => setStep(2)} />
              <Button label={`Keep ${name}`} variant="secondary" onPress={close} />
            </View>
          )}
        </>
      ) : (
        <>
          <Caption tone="muted">Step 2 of 2. Type the bar’s name to delete it.</Caption>
          <Field label={`Type ${name}`} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} autoFocus />
          {matches ? <Line icon="checkmark" color={STATUS.success} text="That’s the name. Capitals don’t matter." small /> : null}
          <View style={[styles.info, { backgroundColor: ds.c.raised }]}>
            <IconSymbol name="clock" size={18} color={ds.c.muted} />
            <DsText variant="label" style={styles.flex}>
              {`${name} goes on `}
              <DsText variant="label" style={styles.strong}>
                {deleteDay(new Date(now + WEEK_MS).toISOString())}
              </DsText>
              {`. Until then it works as normal. Your team sees who asked and when, and any Admin${others.length ? ` (${others.join(', ')} too)` : ''} can undo it.`}
            </DsText>
          </View>
          {remove.error ? (
            <Caption tone="accent" role="alert">
              {remove.error.message}
            </Caption>
          ) : null}
          <View style={[styles.actions, side ? styles.dialogActions : null]}>
            <Button label="Delete in 7 days" variant="danger" disabled={!matches || remove.isPending} onPress={() => remove.mutate({ barId, confirmName: typed }, { onSuccess: close })} />
            <Button label="Back" variant="secondary" onPress={() => setStep(1)} />
          </View>
        </>
      )}
    </SheetScrollView>
  );
}

function Line({ icon, color, text, small }: { icon: 'xmark' | 'checkmark'; color: string; text: string; small?: boolean }) {
  return (
    <View style={styles.line}>
      <IconSymbol name={icon} size={small ? 14 : 16} color={color} style={styles.icon} />
      {small ? (
        <Caption color={color} style={styles.flex}>
          {text}
        </Caption>
      ) : (
        <DsText variant="label" style={styles.flex}>
          {text}
        </DsText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { maxWidth: 520 },
  body: { gap: space.md, padding: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  box: { gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  icon: { marginTop: 3 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  actions: { gap: space.sm, marginTop: space.sm },
  dialogActions: { flexDirection: 'row-reverse', justifyContent: 'flex-start' },
});
