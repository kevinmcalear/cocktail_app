import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSaveServiceNotes } from '@/hooks/useServiceNotes';
import { handoffSteps, handoffText, MAX_HANDOFF_STEPS, type ServiceNotes } from '@/lib/serviceNotes';

import { MenuSheet } from '../menus/MenuSheet';

interface ServiceNotesSheetProps {
  itemId: string;
  barId: string;
  name: string;
  notes: ServiceNotes;
  onClose: () => void;
}

/**
 * Write how the garnish goes on, the hand-off and what the floor says about a
 * venue drink (decision b24). For the drink's editors; the database checks.
 */
export function ServiceNotesSheet({ itemId, barId, name, notes, onClose }: ServiceNotesSheetProps) {
  const save = useSaveServiceNotes(itemId, barId);
  const [garnish, setGarnish] = useState(notes.garnish ?? '');
  const [handoff, setHandoff] = useState(handoffText(notes.handoff));
  const [talkingPoint, setTalkingPoint] = useState(notes.talkingPoint ?? '');
  const [sellItAs, setSellItAs] = useState(notes.sellItAs ?? '');
  const steps = handoffSteps(handoff).filter((s) => s.trim());
  const tooMany = steps.length > MAX_HANDOFF_STEPS;

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Service notes"
      subtitle={name}
      footer={
        <View style={styles.footer}>
          {save.error ? <Caption tone="accent">{save.error.message}</Caption> : null}
          <Button
            label={save.isPending ? 'Saving…' : 'Save'}
            size="lg"
            disabled={save.isPending || tooMany}
            onPress={() => save.mutateAsync({ garnish, handoff: steps, talkingPoint, sellItAs }).then(onClose, () => {})}
          />
        </View>
      }
    >
      <Field label="Garnish" value={garnish} onChangeText={setGarnish} placeholder="Candied ginger on a pick, laid across the rim." minLines={2} maxLength={500} />
      <Field
        label="Hand-off"
        value={handoff}
        onChangeText={setHandoff}
        placeholder={'Coaster down first, logo facing the guest\nSay "smoky on top" as it lands'}
        minLines={3}
        maxLength={1200}
        hint={tooMany ? `Up to ${MAX_HANDOFF_STEPS} steps.` : 'One step per line.'}
      />
      <Field label="Talking point" value={talkingPoint} onChangeText={setTalkingPoint} placeholder="Where it comes from, in a line or two the floor can say." minLines={3} maxLength={1000} />
      <Field label="Sell it as" value={sellItAs} onChangeText={setSellItAs} placeholder="Smoky, spicy, bright. For anyone who likes a whisky sour." multiline maxLength={300} />
      <Caption tone="muted">Employees and up see these. Dietary is read from the spec.</Caption>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
});
