import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { radius, space } from '@/constants/tokens';
import { useCopyPrep, useMakeVenueVersion, type PrepCopySource } from '@/hooks/usePrepCard';
import { plainDbMessage } from '@/lib/dbError';
import { toastDone } from '@/lib/toast';

interface PrepVersionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The prep as edited: the version is made from it. */
  source: PrepCopySource;
  /** How many drinks use it, as this person sees them. */
  drinks: number;
  /** Where the version goes: the active venue (its name), or null for at home. */
  venue: { id: string; name: string } | null;
  /** Why the edit matters to those drinks ("Less water, 450 ml instead of 500 ml, so..."). */
  reason: string | null;
  /** Shown when the person can change the original: save the edit to it. */
  onEditAll?: () => void;
}

/**
 * Saving an edit to a prep other drinks use, or one that isn't yours
 * (prep-prep-edit-shared, decided: ask at Save): how many drinks it reaches
 * and why the edit matters, then two radio cards: the venue's own version,
 * which the venue's drinks switch to while everyone else keeps the shared
 * one, or the change for every drink (only for people who can edit the
 * shared recipe).
 */
export function PrepVersionSheet({ visible, onClose, source, drinks, venue, reason, onEditAll }: PrepVersionSheetProps) {
  const router = useRouter();
  const copy = useCopyPrep();
  const venueVersion = useMakeVenueVersion();
  const [all, setAll] = useState(false);
  const busy = copy.isPending || venueVersion.isPending;
  const title = drinks > 1 ? `${drinks} drinks use this recipe` : drinks === 1 ? '1 drink uses this recipe' : 'This is a shared recipe';
  const whose = venue ? `${venue.name}’s` : 'your';
  const name = venue ? `${source.name} (${venue.name})` : `My ${source.name}`;

  const done = (id: string) => {
    toastDone('Your version is saved', name);
    onClose();
    // The edit is already in it: open its page, in place of the editor.
    router.replace(`/ingredient/${id}` as never);
  };
  const failed = (e: Error) => Alert.alert('Couldn’t save your version', plainDbMessage(e) ?? e.message);
  const save = () => {
    if (all && onEditAll) {
      onClose();
      onEditAll();
    } else if (venue) venueVersion.mutate({ source, name, barId: venue.id }, { onSuccess: (r) => done(r.id), onError: failed });
    else copy.mutate({ source, name, barId: null }, { onSuccess: done, onError: failed });
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={title}
      plain
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" variant="secondary" size="lg" onPress={onClose} />
          <Button label={busy ? 'Saving…' : all ? `Change it for all ${drinks}` : `Edit ${venue ? 'our' : 'your'} version`} size="lg" disabled={busy} onPress={save} style={styles.grow} />
        </View>
      }
    >
      <Body tone="muted">{reason ?? (drinks > 1 ? 'Every one of them would change too.' : 'It isn’t yours to change, so keep the edit as your own version.')}</Body>
      <View role="radiogroup" aria-label="How to save it" style={styles.cards}>
        <Card
          on={!all}
          title={`Edit as ${whose} version`}
          detail={venue ? `${venue.name}’s drinks use yours. Everyone else keeps the shared one.` : 'Only you see it. Your drinks keep the shared one until you swap their line.'}
          onPress={() => setAll(false)}
        />
        {onEditAll ? <Card on={all} title={drinks > 1 ? `Change it for all ${drinks} drinks` : 'Change the shared recipe'} detail="Every drink that uses it pours the new recipe." onPress={() => setAll(true)} /> : null}
      </View>
    </MenuSheet>
  );
}

function Card({ on, title, detail, onPress }: { on: boolean; title: string; detail: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="radio" aria-checked={on} accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={[styles.card, { backgroundColor: ds.c.raised, borderColor: on ? ds.accentText : 'transparent' }]}>
      <View style={[styles.dot, { borderColor: on ? ds.accentText : ds.c.muted, borderWidth: on ? 7 : 2 }]} />
      <View style={styles.grow}>
        <Body>{title}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 2 },
  dot: { width: 22, height: 22, borderRadius: radius.pill, marginTop: 1 },
  grow: { flex: 1 },
  footer: { flexDirection: 'row', gap: space.sm },
});
