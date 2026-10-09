import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { TechniqueSheet } from '@/components/techniques/TechniqueSheet';
import { space } from '@/constants/tokens';
import { useCopyPrep, type PrepCopySource } from '@/hooks/usePrepCard';
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
 * offer a version of your own instead (at your venue, or yours at home)
 * that you can change freely. Its drinks keep the original until their
 * line is swapped.
 */
export function PrepVersionSheet({ visible, onClose, source, drinks, venue, onEditAll }: PrepVersionSheetProps) {
  const router = useRouter();
  const copy = useCopyPrep();
  const [name, setName] = useState(venue ? `${source.name} (${venue.name})` : `My ${source.name}`);
  const reach = drinks === 1 ? '1 drink uses this recipe' : `${drinks} drinks use this recipe`;
  const make = () =>
    copy.mutate(
      { source, name: name.trim() || source.name, barId: venue?.id ?? null },
      {
        onSuccess: (id) => {
          toastDone('Your version is ready', name.trim());
          onClose();
          router.push(`/ingredient/${id}` as never);
        },
        onError: (e) => Alert.alert('Couldn’t make your version', plainDbMessage(e) ?? e.message),
      },
    );

  return (
    <TechniqueSheet visible={visible} onClose={onClose} eyebrow={onEditAll ? 'Before you change it' : 'Your own version'} title={onEditAll ? reach : source.name}>
      <Body tone="muted">
        {onEditAll
          ? 'Changing it changes every one of them. To try something different, make a version of your own.'
          : `Copy it ${venue ? `to ${venue.name}` : 'to your bar at home'} and change it however you like. ${drinks ? 'Drinks keep using this one until you swap their line.' : ''}`}
      </Body>
      <View style={styles.stack}>
        <Field label="Your version’s name" value={name} onChangeText={setName} maxLength={80} />
        <Button label={copy.isPending ? 'Making it…' : 'Make your own version'} variant={onEditAll ? 'secondary' : 'primary'} disabled={copy.isPending} onPress={make} />
        {onEditAll ? (
          <>
            <Button
              label={`Edit it for all ${drinks}`}
              onPress={() => {
                onClose();
                onEditAll();
              }}
            />
            <Caption tone="muted">Every drink that uses it will pour the new recipe.</Caption>
          </>
        ) : null}
      </View>
    </TechniqueSheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
});
