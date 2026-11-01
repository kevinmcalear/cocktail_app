import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useApproveDrink, useDrinkApproval, useMyDrinkTypes } from '@/hooks/useDrinkApproval';
import { readableAccent, withAlpha } from '@/lib/color';
import { tastedLine } from '@/lib/menuLens';

/**
 * A venue drink added by a role limited to some drink kinds waits for
 * approval (dec-25, tf-059). Its maker reads that it waits; someone who edits
 * every kind there gets Approve. Nobody else is sent the drink until then.
 */
export function ApprovalNotice({ itemId }: { itemId: string }) {
  const ds = useDs();
  const userId = useUserId();
  const { data } = useDrinkApproval(itemId);
  const barId = data?.barId ?? null;
  const caps = useCapabilities(barId).data ?? [];
  const myTypes = useMyDrinkTypes(barId).data;
  const approve = useApproveDrink();
  if (!data?.waiting) return null;
  const approver = caps.includes('edit_drinks') && myTypes === null;
  return (
    <View style={[styles.box, { borderColor: ds.c.lineStrong }]} role="status">
      <View style={styles.row}>
        <IconSymbol name="clock" size={16} color={ds.c.muted} />
        <Body style={styles.flex}>Waiting for approval</Body>
      </View>
      <Caption tone="muted">
        {approver
          ? 'The rest of the team sees it once you approve it.'
          : data.createdBy === userId
            ? 'A manager approves it before the rest of the team sees it.'
            : 'Someone who edits every kind of drink here approves it.'}
      </Caption>
      {approver ? <Button label={approve.isPending ? 'Approving…' : 'Approve'} size="sm" disabled={approve.isPending} onPress={() => approve.mutate(itemId)} /> : null}
      {approve.error ? (
        <Caption tone="accent" role="alert">
          {approve.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * "Tasted and approved by Ana Ruiz, 28 Oct." under the spec, for the drink's
 * team (approval-states; Red-versions, Tasted and approved). Stamped when its
 * wait for approval clears; drinks approved before the stamp say nothing.
 */
export function TastedLine({ itemId }: { itemId: string }) {
  const ds = useDs();
  const { data } = useDrinkApproval(itemId);
  const members = useBarMembers(data?.approvedBy ? data.barId : null).data;
  if (!data || data.waiting || !data.approvedAt) return null;
  const name = members?.find((m) => m.user_id === data.approvedBy)?.display_name ?? null;
  const green = readableAccent(STATUS.success, ds.c.ground);
  return (
    <View style={[styles.tasted, { backgroundColor: withAlpha(green, 0.1) }]}>
      <IconSymbol name="checkmark" size={16} color={green} />
      <Body style={styles.flex}>{tastedLine(name, data.approvedAt)}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  tasted: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.control, borderCurve: 'continuous' },
  box: { gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
