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
  source: PrepCopySource;
  /** How many drinks use it, as this person sees them. */
  drinks: number;
  /** Where the copy goes: the active venue (its name), or null for at home. */
  venue: { id: string; name: string } | null;
  /** Shown when the person can change the original: open its editor. */
  onEditAll?: () => void;
}

/**
 * Before a prep other drinks use is changed: say how many it reaches, and
 * offer two ways (prep-prep-edit-shared): the venue's own version, which the
 * venue's drinks switch to while everyone else keeps the shared one, or the
 * change for every drink (only for people who can edit the shared recipe).
 */
export function PrepVersionSheet({ visible, onClose, source, drinks, venue, onEditAll }: PrepVersionSheetProps) {
  const router = useRouter();
  const copy = useCopyPrep();
  const venueVersion = useMakeVenueVersion();
  const [all, setAll] = useState(false);
  const busy = copy.isPending || venueVersion.isPending;
  const reach = drinks === 1 ? '1 drink uses this recipe' : `${drinks} drinks use this recipe`;
  const whose = venue ? `${venue.name}’s` : 'your';
  const name = venue ? `${source.name} (${venue.name})` : `My ${source.name}`;

  const done = (id: string) => {
    toastDone('Your version is ready', name);
    onClose();
    // Straight into its editor: the change they came to make.
    router.push(`/ingredient/${id}/edit` as never);
  };
  const failed = (e: Error) => Alert.alert('Couldn’t make your version', plainDbMessage(e) ?? e.message);
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
      title={drinks > 1 ? reach : source.name}
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.grow} />
          <Button label={busy ? 'Making it…' : all ? `Edit it for all ${drinks}` : `Make ${venue ? 'our' : 'your'} version`} disabled={busy} onPress={save} style={styles.grow} />
        </View>
      }
    >
      <Body tone="muted">{onEditAll ? 'Changing it changes every one of them, so each would taste a little different.' : 'Copy it and change it however you like.'}</Body>
      <View role="radiogroup" aria-label="How to change it" style={styles.cards}>
        <Card
          on={!all}
          title={`Make ${whose} version`}
          detail={venue ? `${venue.name}’s drinks use yours. Everyone else keeps the shared one.` : 'Only you see it. Your drinks keep the shared one until you swap their line.'}
          onPress={() => setAll(false)}
        />
        {onEditAll ? <Card on={all} title={`Change it for all ${drinks} drinks`} detail="Every drink that uses it pours the new recipe." onPress={() => setAll(true)} /> : null}
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
