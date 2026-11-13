import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, SheetScrollView, Title } from '@/components/ds';
import { ListGroup, ListRow } from '@/components/ds/ListGroup';
import { Prompt } from '@/components/screens/addDrink/Prompt';
import { space } from '@/constants/tokens';
import { useOnline } from '@/hooks/useOnline';
import { useUnsentWrites, type UnsentWrite } from '@/hooks/useUnsentWrites';
import { confirmAsync } from '@/lib/dialogs';
import type { CreateDrinkInput } from '@/hooks/useCreateDrink';
import { discardWrite, resendWrite } from '@/lib/keptWrites';
import { HOME_BAR } from '@/lib/itemRoutes';
import { isNetworkError } from '@/lib/offlineWrites';
import { slotStart } from '@/lib/wizardSlots';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { STILL_IN_ADD, unsentAction, unsentDetail, unsentTitle } from '@/lib/unsentRows';
import { didntSendWords, waitingWords } from '@/lib/unsentWords';

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const actionOf = (w: UnsentWrite) => unsentAction(w.write.options.mutationKey, w.failed, isNetworkError(w.write.state.error));

/** A refused drink's draft, still in Add: opened where it was kept (as New's drafts open it, components/nav/NewDrafts.tsx). */
function openInAdd(v: CreateDrinkInput) {
  const slot = Object.entries(useDrinkWizardStore.getState().kept).find(([, k]) => !!v.draft.id && k.draft.id === v.draft.id)?.[0];
  const start = slot ? slotStart(slot) : undefined;
  router.push({
    pathname: '/add-cocktail',
    params: {
      barId: v.barId ?? HOME_BAR,
      ...(start?.menuSectionId ? { menuSectionId: start.menuSectionId } : {}),
      ...(start?.name ? { name: start.name } : {}),
      ...(start?.from ? { from: start.from } : {}),
    },
  });
}

/**
 * What's saved on this phone and not in yet (Sta-errors, Didn't send and
 * Waiting to send): an amber card, "2 changes didn't send" or "2 changes
 * waiting to send", what they are, Send now and See them. See them lists each
 * with Send, and Discard all (asked first). Nothing shows when all is in.
 */
export function UnsentWrites() {
  const unsent = useUnsentWrites();
  const offline = !useOnline();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  if (!unsent.length) return null;
  const failed = unsent.filter((w) => w.failed).length;
  const names = unsent.map((w) => unsentTitle(w.write.options.mutationKey, w.variables));
  const sendAll = () => unsent.forEach((w) => actionOf(w) === 'send' && resendWrite(client, w.write));
  return (
    <>
      <Prompt
        warn
        ink
        icon="exclamationmark.triangle"
        title={failed ? didntSendWords(failed) : waitingWords(unsent.length)}
        body={`${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}. ${offline ? 'They’re kept on this phone and send when you’re back.' : 'They’re kept on this phone.'}`}
        actions={[
          { label: 'Send now', onPress: sendAll, disabled: offline },
          { label: 'See them', onPress: () => setOpen(true) },
        ]}
      />
      <UnsentSheet visible={open} unsent={unsent} offline={offline} onClose={() => setOpen(false)} />
    </>
  );
}

function UnsentSheet({ visible, unsent, offline, onClose }: { visible: boolean; unsent: UnsentWrite[]; offline: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const discardAll = async () => {
    const n = unsent.length;
    const ok = await confirmAsync({
      title: n === 1 ? 'Discard this change?' : `Discard ${n} changes?`,
      message: 'They haven’t sent, and they can’t be got back.',
      confirmText: 'Discard',
      destructive: true,
    });
    if (!ok) return;
    // Newest first: each puts back what was there before it, so the oldest's copy is what's left.
    [...unsent].reverse().forEach((w) => discardWrite(client, w.write));
    onClose();
  };
  return (
    <Sheet
      visible={visible && unsent.length > 0}
      onClose={onClose}
      accessibilityLabel="Waiting to send"
      header={
        <View style={styles.head}>
          <Title role="heading">Waiting to send</Title>
        </View>
      }
    >
      <SheetScrollView>
        <View style={styles.body}>
          <ListGroup>
            {unsent.map((w, i) => {
              const action = actionOf(w);
              const open = () => {
                onClose();
                openInAdd(w.variables as CreateDrinkInput);
              };
              return (
                <ListRow
                  key={w.write.mutationId}
                  first={i === 0}
                  icon={w.failed ? 'exclamationmark.triangle' : 'clock'}
                  warn={!!w.failed}
                  title={unsentTitle(w.write.options.mutationKey, w.variables)}
                  detail={`${unsentDetail(w.failed, w.at, timeOf)}${action === 'add' ? ` ${STILL_IN_ADD}` : ''}`}
                  end={
                    action === 'send' ? (
                      <Button label="Send" size="sm" variant="secondary" disabled={offline} onPress={() => resendWrite(client, w.write)} />
                    ) : action === 'add' ? (
                      <Button label="Open" size="sm" variant="secondary" onPress={open} />
                    ) : undefined
                  }
                />
              );
            })}
          </ListGroup>
          <Button label={unsent.length === 1 ? 'Discard it' : 'Discard all'} variant="plain" onPress={() => void discardAll()} />
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { gap: space.lg, padding: space.lg },
});
