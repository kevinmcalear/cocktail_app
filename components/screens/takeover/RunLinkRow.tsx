import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useEndRunSheetLink, usePublicRunSheet, useRunSheetLinkToken, useSaveRunSheetLink } from '@/hooks/useTakeover';
import { confirmAsync } from '@/lib/dialogs';
import type { PartySheet, RunSheet } from '@/lib/runSheet';
import { partyList } from '@/lib/runSheetText';
import { shareOrCopy } from '@/lib/shareLink';
import { saveErrorWords } from '@/lib/saveErrorWords';
import { refusalWords, sentDay } from '@/lib/takeover';
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
 * End (not drawn on the board) takes the link away (end_run_sheet_link):
 * the page then says it has ended, and Send makes a new one.
 */
export function RunLinkRow({ party, sheet, menu, canSend, first, color }: { party: PartySheet; sheet: RunSheet; menu: Menu; canSend: boolean; first?: boolean; color: string | null }) {
  const ds = useDs();
  const id = party.id!;
  const token = useRunSheetLinkToken(canSend ? id : null).data;
  const saved = usePublicRunSheet(token).data;
  const save = useSaveRunSheetLink(id);
  const end = useEndRunSheetLink(id);
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
    } catch (e) {
      setProblem(refusalWords(e, saveErrorWords));
    }
  };

  const stop = async () => {
    const ok = await confirmAsync({ title: `End ${name}?`, message: 'The page stops opening for anyone who has it. You can send a new link after.', confirmText: 'End link' });
    if (!ok) return;
    setProblem(null);
    try {
      await end.mutateAsync();
      if (token) void client.invalidateQueries({ queryKey: ['public-run-sheet', token] });
    } catch (e) {
      setProblem(refusalWords(e, saveErrorWords));
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
        <>
          <PressableScale role="button" accessibilityLabel={`${name}. ${line}. Share it again`} onPress={() => void send()} disabled={save.isPending} style={styles.press}>
            {words}
          </PressableScale>
          <PressableScale role="button" accessibilityLabel={`End ${name}`} onPress={() => void stop()} disabled={end.isPending} style={styles.end}>
            <Caption tone="accent">End</Caption>
          </PressableScale>
        </>
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
  end: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
});
