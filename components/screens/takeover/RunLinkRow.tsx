import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { usePublicRunSheet, useRunSheetLinkToken, useSaveRunSheetLink } from '@/hooks/useTakeover';
import type { PartySheet, RunSheet } from '@/lib/runSheet';
import { partyList } from '@/lib/runSheetText';
import { shareOrCopy } from '@/lib/shareLink';
import { sentDay } from '@/lib/takeover';
import { siteOrigin } from '@/lib/venueLink';
import type { Json } from '@/types/db';

import { BarMark } from './parts';

type Menu = { name: string; startsAt: string | null; endsAt: string | null };

/** A party's link with no account: /run/<token>. */
export const runLinkUrl = (token: string) => `${siteOrigin()}/run/${token}`;

/**
 * One party's run-sheet link (takeover C): "Sent Tue" once it has one, else
 * "Not sent yet" and Send. Sending saves just their part of the sheet
 * (partyList: their drinks, what they bring, everyone else's) behind the link
 * and shares it; tapping a sent one saves the latest and shares it again.
 */
export function RunLinkRow({ party, sheet, menu, canSend, first, color }: { party: PartySheet; sheet: RunSheet; menu: Menu; canSend: boolean; first?: boolean; color: string | null }) {
  const ds = useDs();
  const id = party.id!;
  const token = useRunSheetLinkToken(canSend ? id : null).data;
  const saved = usePublicRunSheet(token).data;
  const save = useSaveRunSheetLink(id);
  const client = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const name = `${party.name}’s link`;

  const send = async () => {
    setProblem(null);
    try {
      const list = partyList(sheet, menu, party);
      const next = await save.mutateAsync(list as unknown as Json);
      void client.invalidateQueries({ queryKey: ['public-run-sheet', next] });
      await shareOrCopy(runLinkUrl(next), `${party.name}: ${menu.name}`, 'menu', `Your run sheet for ${menu.name}. No account needed.`);
    } catch {
      setProblem('Couldn’t make the link. Check your connection and try again.');
    }
  };

  // Only the people who plan the run sheet can read whether a link exists.
  const line = problem ?? (!canSend ? 'Sent by whoever plans the run sheet' : token ? (saved ? `Sent ${sentDay(saved.saved_at)}` : 'Sent') : 'Not sent yet');
  const words = (
    <>
      <BarMark name={party.name} color={color} />
      <View style={styles.words}>
        <Body numberOfLines={1}>{name}</Body>
        <Caption tone="muted" color={problem ? ds.accentText : undefined}>
          {line}
        </Caption>
      </View>
    </>
  );
  return (
    <View role="listitem" style={[styles.row, { borderTopColor: first ? 'transparent' : ds.c.line }]}>
      {token ? (
        <PressableScale role="button" accessibilityLabel={`${name}. ${line}. Share it again`} onPress={() => void send()} disabled={save.isPending} style={styles.press}>
          {words}
        </PressableScale>
      ) : (
        <>
          {words}
          {canSend ? <Button label="Send" size="sm" onPress={() => void send()} disabled={save.isPending} accessibilityLabel={`Send ${name}`} /> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm + 2, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  press: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  words: { flex: 1, minWidth: 0 },
});
