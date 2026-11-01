import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useBarProfile } from '@/hooks/useRankings';

import { useAgeGate } from '../safety/AgeGate';
import { RankFlow } from './RankActions';
import { RankFindSheet, type RankPick } from './RankFindSheet';
import { useSnapMenu } from './useSnapMenu';

/** How Rank it starts: the find sheet, or straight to ranking one drink (the suggested row). */
export type RankItStart = { kind: 'find' } | ({ kind: 'rank' } & RankPick);

interface RankItFlowProps {
  start: RankItStart;
  onClose: () => void;
}

/**
 * Home Tonight's Rank it, from the age check to the rank sheet: the find
 * sheet (RankFindSheet), then the comparison sheet for the drink picked,
 * had at the bar picked (RankFlow's atBar). Loaded when first tapped, so
 * Tonight doesn't carry it. Mount it fresh for each tap.
 */
export function RankItFlow({ start, onClose }: RankItFlowProps) {
  const ageGate = useAgeGate();
  const onSnap = useSnapMenu();
  const [finding, setFinding] = useState(false);
  const [ranking, setRanking] = useState<RankPick | null>(null);
  // iOS presents one modal at a time: what comes next waits until the find sheet has gone (onDismiss).
  const next = useRef<(() => void) | null>(null);

  // Ranking needs a confirmed age; the gate asks first when it isn't.
  const begin = useEffectEvent(() => ageGate.gate(() => (start.kind === 'find' ? setFinding(true) : setRanking(start))));
  useEffect(() => begin(), []);

  // Closed on the way to something else: its dismissal mustn't end the flow (the web's Modal reports one too).
  const moving = useRef(false);

  const leave = (then: () => void) => {
    moving.current = true;
    setFinding(false);
    if (Platform.OS === 'ios') next.current = then;
    else then();
  };

  return (
    <>
      <RankFindSheet
        visible={finding}
        onPick={(pick) => leave(() => setRanking(pick))}
        // The web opens its camera only straight from a tap, so it isn't put off there.
        onSnap={
          onSnap
            ? () => {
                if (Platform.OS !== 'ios') onSnap();
                leave(() => {
                  if (Platform.OS === 'ios') onSnap();
                  onClose();
                });
              }
            : null
        }
        onClose={() => {
          setFinding(false);
          if (Platform.OS !== 'ios') onClose();
        }}
        onDismiss={() => {
          const then = next.current;
          next.current = null;
          if (then) then();
          else if (!moving.current) onClose();
        }}
      />
      {ranking ? <RankAt pick={ranking} onClose={onClose} /> : null}
      {ageGate.sheet}
    </>
  );
}

/** The rank sheet for a drink had at a bar (its public page, loaded first) or with no bar. */
function RankAt({ pick, onClose }: { pick: RankPick; onClose: () => void }) {
  const bar = useBarProfile(null, pick.barId);
  if (pick.barId && bar.isPending) return null;
  return <RankFlow item={{ id: pick.itemId, name: pick.name, bar_id: null }} picture={null} atBar={bar.data ?? null} onClose={onClose} />;
}
