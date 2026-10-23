import { useState } from 'react';
import { View } from 'react-native';

import { Button, Caption, Field } from '@/components/ds';
import { AddBarForm } from '@/components/screens/home/AddBar';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { usePartySearch, useRemoveParty, useSaveParty } from '@/hooks/useRunSheet';
import { plainDbMessage } from '@/lib/dbError';
import type { RunParty } from '@/lib/runSheet';

/**
 * Add or change the guest bar (coming to us, or the bar we're going to when
 * `venue`) or a brand, by name, linked to their page when they have one
 * (board 8). A bar with no page can be added the usual way (Add a bar, with
 * its street address); a typed name never makes one.
 */
export function PartySheet({ menuId, kind, party, venue, sortOrder, onClose }: { menuId: string; kind: 'guest' | 'brand'; party: RunParty | null; venue?: boolean; sortOrder: number; onClose: () => void }) {
  const [name, setName] = useState(party?.name ?? '');
  const [profileId, setProfileId] = useState<string | null>(party?.profileId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const search = usePartySearch(profileId ? '' : name, kind);
  const save = useSaveParty(menuId);
  const remove = useRemoveParty(menuId);
  const done = { onSuccess: onClose, onError: (e: unknown) => setError(plainDbMessage(e) ?? 'That didn’t save. Try again.') };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      form
      title={kind === 'guest' ? (venue ? 'Whose bar is it?' : 'Who’s coming to us?') : party ? party.name : 'Add a brand'}
      subtitle={
        kind === 'brand'
          ? 'A bottle this brand makes goes to them on the sheet.'
          : venue
            ? 'The bar you’re taking over for the night. Everything starts with them except the house preps for your drinks. Their drinks are credited to them.'
            : 'The bar taking over for the night. Their house preps start with them, and their drinks are credited to them.'
      }
      save={{ label: 'Save', disabled: !name.trim() || save.isPending, onPress: () => save.mutate({ id: party?.id, kind, name, profileId, sortOrder, isVenue: venue }, done) }}
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
        {kind === 'guest' && party?.profileId && !profileId ? (
          <Caption tone="accent">Saving like this unlinks their page and takes its credit off their drinks. Pick their page again to keep it.</Caption>
        ) : null}
        {search.data?.length ? <Caption tone="muted">On Cocktail: is it one of these?</Caption> : null}
        {(search.data ?? []).map((p) => (
          <Choice
            key={p.id}
            label={p.display_name}
            detail={[p.place, `@${p.handle}`, kind === 'guest' && !p.claimed ? 'Not claimed yet' : null].filter(Boolean).join(' · ')}
            selected={false}
            onPress={() => {
              setName(p.display_name);
              setProfileId(p.id);
            }}
          />
        ))}
        {kind === 'guest' && !profileId && name.trim().length >= 2 && !search.isFetching ? (
          adding ? (
            <AddBarForm
              initialName={name.trim()}
              onAdded={(v) => {
                setName(v.display_name);
                setProfileId(v.id);
                setAdding(false);
              }}
              onOpenExisting={(id) => {
                setProfileId(id);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
              <Caption tone="muted">Not here? Add them the usual way, with their street address. Or save just the name and link it later.</Caption>
              <Button label={`Add ${name.trim()} to Cocktail`} size="sm" variant="secondary" onPress={() => setAdding(true)} />
            </View>
          )
        ) : null}
        {error ? <Caption tone="accent">{error}</Caption> : null}
      </View>
    </MenuSheet>
  );
}
