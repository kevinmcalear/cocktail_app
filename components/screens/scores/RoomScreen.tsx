import { ActivityIndicator, View } from 'react-native';

import { BackbarTheme, Body, useDs } from '@/components/ds';
import { BlockLabel } from '@/components/screens/rankings/ScoreRows';
import { useBarGuestSays } from '@/hooks/useScores';
import { formatScore } from '@/lib/ranking';
import { ROOM_REASONS } from '@/lib/rankResult';
import { changeLine, num, tallyRows } from '@/lib/scores';

import { Meter, Note, ScoreLine, ScorePage } from './ScoreParts';

/**
 * What guests say about the bar (Kept-score "roomseen"), for its Admins: the
 * score for its drinks and how it moved since the menu went on, and the room
 * as people who ranked a drink here described it, in the last 90 days.
 * Totals only, once 20 have said something.
 */
export function RoomScreen({ barId, barName }: { barId: string; barName?: string }) {
  return (
    <BackbarTheme>
      <Room barId={barId} barName={barName} />
    </BackbarTheme>
  );
}

function Room({ barId, barName }: { barId: string; barName?: string }) {
  const ds = useDs();
  const { data: r, isLoading, error } = useBarGuestSays(barId);
  const score = num(r?.score);
  let body;
  if (error) body = <Body tone="muted">{(error as { code?: string }).code === '42501' ? 'Only the bar’s Admins see what guests say about it.' : 'Couldn’t load what guests say. Try again in a moment.'}</Body>;
  else if (isLoading || !r) body = <ActivityIndicator color={ds.c.muted} />;
  else {
    const change = changeLine(num(r.change), r.menu);
    const rows = tallyRows(r.room, ROOM_REASONS);
    body = (
      <>
        {score != null ? <ScoreLine title={`${formatScore(score)} for your drinks`} sub={change} /> : null}
        <View>
          <BlockLabel>About the room</BlockLabel>
          {r.room ? <Meter rows={rows.map((x) => ({ label: x.label, n: x.n, warn: x.negative }))} /> : <Body tone="muted">{`${r.room_people} of ${r.floor} so far have said something about the room.`}</Body>}
        </View>
        <Note icon="person.2.fill">{`From ${r.people} ${r.people === 1 ? 'person' : 'people'} who ranked a drink here. Shown once ${r.floor} have said something.`}</Note>
      </>
    );
  }
  return (
    <ScorePage eyebrow={[barName, 'last 90 days', 'Admins only'].filter(Boolean).join(' · ')} title="What guests say">
      {body}
    </ScorePage>
  );
}
