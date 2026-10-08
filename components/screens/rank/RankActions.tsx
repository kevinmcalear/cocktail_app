import { useRouter } from 'expo-router';
import { useState } from 'react';

import { GlassButton } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { signatureBarOf, useBarProfile, useMyRankList, useRankTarget, type RankVenue } from '@/hooks/useRankings';
import type { ItemPicture } from '@/lib/itemImages';
import { rankedAs as rankedAsOf } from '@/lib/ranking';

import { useAgeGate } from '../safety/AgeGate';
import { RankSheet } from './RankSheet';

interface RankItem {
  id: string;
  name: string;
  bar_id: string | null;
}

interface RankActionsProps {
  item: RankItem;
  picture: ItemPicture | null;
}

/** "Rank it" (the comparison sheet) and "Rankings" (/rankings/[itemId]) for a drink page. */
export function RankActions({ item, picture }: RankActionsProps) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  const { data: target } = useRankTarget(item.id);
  const rankedAs = target ? rankedAsOf(target) : null;
  // Ranking needs a confirmed age.
  const ageGate = useAgeGate();

  return (
    <>
      {signedIn ? <GlassButton accessibilityLabel={`Rank ${item.name} against others you've had`} label="Rank it" icon="list.number" onPress={() => ageGate.gate(() => setOpen(true))} /> : null}
      <GlassButton accessibilityLabel={`Rankings for ${rankedAs?.name ?? item.name}`} label="Rankings" icon="trophy" onPress={() => router.push(`/rankings/${item.id}`)} />
      {open ? <RankFlow item={item} picture={picture} onClose={() => setOpen(false)} /> : null}
      {ageGate.sheet}
    </>
  );
}

interface RankFlowProps extends RankActionsProps {
  /** Where it was had when the drink has no bar of its own (a classic ranked on a bar's page). */
  atBar?: RankVenue | null;
  onClose: () => void;
}

/**
 * The comparison sheet for one drink, loading what it needs first. Mount it
 * once someone taps Rank (after the age check), not before.
 */
export function RankFlow({ item, picture, atBar = null, onClose }: RankFlowProps) {
  const router = useRouter();
  const { data: target } = useRankTarget(item.id);
  const { data: ownBar } = useBarProfile(item.bar_id, signatureBarOf(target));
  const rankedAs = target ? rankedAsOf(target) : null;
  const { data: list, isError: listFailed } = useMyRankList(rankedAs?.id);
  if (!rankedAs) return null;
  return (
    <RankSheet
      drink={{ id: item.id, name: item.name, picture }}
      rankedAs={rankedAs}
      ownBar={ownBar ?? atBar}
      list={list}
      listFailed={listFailed}
      onClose={onClose}
      onSeeRankings={() => {
        onClose();
        router.push(`/rankings/${item.id}`);
      }}
    />
  );
}
