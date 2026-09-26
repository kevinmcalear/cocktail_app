import { useRouter } from 'expo-router';
import { useState } from 'react';

import { GlassButton } from '@/components/ds';
import { useAuth } from '@/ctx/AuthContext';
import { useBarProfile, useMyRankList, useRankTarget } from '@/hooks/useRankings';
import type { ItemPicture } from '@/lib/itemImages';
import { rankedAs as rankedAsOf } from '@/lib/ranking';

import { RankSheet } from './RankSheet';

interface RankActionsProps {
  item: { id: string; name: string; bar_id: string | null };
  picture: ItemPicture | null;
}

/** "Rank it" (the comparison sheet) and "Rankings" (/rankings/[itemId]) for a drink page. */
export function RankActions({ item, picture }: RankActionsProps) {
  const router = useRouter();
  const signedIn = !!useAuth().user;
  const [open, setOpen] = useState(false);
  const { data: target } = useRankTarget(item.id);
  const { data: ownBar } = useBarProfile(item.bar_id);
  const rankedAs = target ? rankedAsOf(target) : null;
  const { data: list, isError: listFailed } = useMyRankList(open ? rankedAs?.id : null);
  const toRankings = () => router.push(`/rankings/${item.id}`);

  return (
    <>
      {signedIn ? <GlassButton accessibilityLabel={`Rank ${item.name} against others you've had`} label="Rank it" icon="list.number" onPress={() => setOpen(true)} /> : null}
      <GlassButton accessibilityLabel={`Rankings for ${rankedAs?.name ?? item.name}`} label="Rankings" icon="trophy" onPress={toRankings} />
      {open && rankedAs ? (
        <RankSheet
          drink={{ id: item.id, name: item.name, picture }}
          rankedAs={rankedAs}
          ownBar={ownBar ?? null}
          list={list}
          listFailed={listFailed}
          onClose={() => setOpen(false)}
          onSeeRankings={() => {
            setOpen(false);
            toRankings();
          }}
        />
      ) : null}
    </>
  );
}
