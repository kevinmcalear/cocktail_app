import { useState } from 'react';
import { View } from 'react-native';

import { Button, Caption, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { usePartySearch, useRemoveParty, useSaveParty } from '@/hooks/useRunSheet';
import { plainDbMessage } from '@/lib/dbError';
import type { RunParty } from '@/lib/runSheet';

/** Add or change the bar coming to us or a brand, by name, linked to their page when they have one. */
export function PartySheet({ menuId, kind, party, sortOrder, onClose }: { menuId: string; kind: 'guest' | 'brand'; party: RunParty | null; sortOrder: number; onClose: () => void }) {
  const [name, setName] = useState(party?.name ?? '');
  const [profileId, setProfileId] = useState<string | null>(party?.profileId ?? null);
  const [error, setError] = useState<string | null>(null);
  const search = usePartySearch(profileId ? '' : name, kind);
  const save = useSaveParty(menuId);
  const remove = useRemoveParty(menuId);
  const done = { onSuccess: onClose, onError: (e: unknown) => setError(plainDbMessage(e) ?? 'That didn’t save. Try again.') };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      form
      title={kind === 'guest' ? 'Who’s coming to us?' : party ? party.name : 'Add a brand'}
      subtitle={kind === 'guest' ? 'The bar taking over for the night. Their house preps start with them.' : 'A bottle this brand makes goes to them on the sheet.'}
      save={{ label: 'Save', disabled: !name.trim() || save.isPending, onPress: () => save.mutate({ id: party?.id, kind, name, profileId, sortOrder }, done) }}
      footer={
        party ? (
          <Button
            label="Take off the sheet"
            variant="ghost"
            accessibilityHint="What they were bringing goes back to us"
            onPress={() => remove.mutate(party.id, done)}
          />
        ) : undefined
      }
    >
      <View style={{ gap: space.md }}>
        <Field
          label={kind === 'guest' ? 'Venue' : 'Brand'}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setProfileId(null);
          }}
          placeholder={kind === 'guest' ? 'Little Rye' : 'Mill & Ash Gin'}
          autoFocus={!party}
        />
        {profileId ? <Caption tone="muted">Linked to their page.</Caption> : null}
        {(search.data ?? []).map((p) => (
          <Choice
            key={p.id}
            label={p.display_name}
            detail={`@${p.handle}`}
            selected={false}
            onPress={() => {
              setName(p.display_name);
              setProfileId(p.id);
            }}
          />
        ))}
        {error ? <Caption tone="accent">{error}</Caption> : null}
      </View>
    </MenuSheet>
  );
}
