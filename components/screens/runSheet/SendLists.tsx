import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { PartySheet, RunSheet } from '@/lib/runSheet';
import { partyListHtml } from '@/lib/runSheetHtml';
import { partyList, partyListText, thingCount } from '@/lib/runSheetText';

import { Dot, type PartyLook } from './parts';
import { sharePdf } from './sharePdf';

type Menu = { name: string; startsAt: string | null; endsAt: string | null };

// A browser without a share sheet (most desktops) copies the list to paste into an email.
const canShareOnWeb = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * "Send each their list" (board R1): every other bar or brand with things to
 * bring (or a guest bar with drinks of its own) gets just their part, a
 * one-page PDF on a phone, else as text. `claimUrls`: party id to its
 * unclaimed bar page, for the claim line (board 10).
 */
export function SendLists({ sheet, menu, looks, claimUrls }: { sheet: RunSheet; menu: Menu; looks: PartyLook[]; claimUrls: Record<string, string> }) {
  const ds = useDs();
  // What was copied, so the button says Copied only while the list is still the same.
  const [copied, setCopied] = useState<string | null>(null);
  const drinksOf = (p: PartySheet) => partyList(sheet, menu, p).drinks.length;
  const others = sheet.parties.filter((p) => p.id !== null && (p.needs.length || drinksOf(p)));
  if (!others.length) return null;
  const copies = Platform.OS === 'web' && !canShareOnWeb();

  const send = async (party: PartySheet) => {
    const list = partyList(sheet, menu, party, claimUrls[party.id ?? '']);
    const text = partyListText(list);
    if (copies) {
      await Clipboard.setStringAsync(text);
      setCopied(text);
      return;
    }
    const title = `${party.name}: ${menu.name}`;
    // A PDF that fails to make (or a web browser) still sends the list as text.
    const sent = await sharePdf(partyListHtml(list), title).catch(() => false);
    if (!sent) await Share.share({ title, message: text }).catch(() => undefined);
  };

  return (
    <View role="group" aria-label="Send each their list" style={{ gap: space.xs }}>
      <Headline>Send each their list</Headline>
      <Caption tone="muted">Just their part: what to bring or have ready, how much, and when.</Caption>
      <View style={[styles.box, { backgroundColor: ds.c.surface }]}>
        {others.map((p, i) => {
          const look = looks.find((l) => l.id === p.id);
          return (
            <View key={p.id} style={[styles.row, i < others.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ds.c.line } : null]}>
              {look ? <Dot colour={look.colour} size={10} /> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Body numberOfLines={1} style={{ fontFamily: fontFamilies.bodySemiBold }}>{p.name}</Body>
                <Caption tone="muted">{`${look?.role ?? p.role} · ${p.needs.length ? thingCount(p.needs.length) : `${drinksOf(p)} of their drinks`}`}</Caption>
              </View>
              <Button
                label={copies && copied === partyListText(partyList(sheet, menu, p, claimUrls[p.id ?? ''])) ? 'Copied' : copies ? 'Copy their list' : 'Send their list'}
                size="sm"
                variant="secondary"
                icon={copies ? 'doc.on.doc' : 'square.and.arrow.up'}
                accessibilityLabel={`${copies ? 'Copy' : 'Send'} ${p.name} their list`}
                onPress={() => void send(p)}
              />
            </View>
          );
        })}
      </View>
      {copies ? <Caption tone="muted">Copies their list to paste into an email or a message.</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.card, paddingHorizontal: space.lg, borderCurve: 'continuous', marginTop: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
});
