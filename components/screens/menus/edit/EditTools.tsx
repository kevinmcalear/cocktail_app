import { StyleSheet } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { font, layout, radius, space } from '@/constants/tokens';
import { layoutProblem } from '@/lib/menuLayout';

import type { LayoutEditor } from '../useLayoutEditor';
import { addTarget } from './EditParts';
import type { EditViewProps } from './MenuEditScreen';

/**
 * What holds saving up, said where it can be seen (the toolbar): a save that
 * failed, or a change autosave won't write yet (a section with no name).
 */
export function saveProblem(editor: LayoutEditor): string | null {
  return editor.error ?? (editor.changed ? layoutProblem(editor.layout) : null);
}

/** The editor's tools (Menu-who-creator-edit's toolbar): Add drink, Section, Dates (Night at home), and Done in ink. */
export function EditTools({ editor, look, onDates, done }: EditViewProps) {
  const ds = useDs();
  const target = addTarget(editor);
  return (
    <>
      <Tool label="Add drink" hint="Add a drink to the menu" onPress={target ? () => editor.setSheet({ kind: 'add', key: target }) : undefined} />
      <Tool label="Section" hint="Add a section" onPress={editor.addSection} />
      {onDates ? <Tool label={look.home ? 'Night' : 'Dates'} hint={look.home ? 'The night and who’s coming' : 'When it goes on'} onPress={onDates} /> : null}
      <PressableScale role="button" accessibilityLabel={editor.saving ? 'Saving' : 'Done editing'} disabled={editor.saving} onPress={done} style={[styles.done, { backgroundColor: ds.c.ink }]}>
        <DsText variant="label" color={ds.c.ground} style={font.semiBold}>
          Done
        </DsText>
      </PressableScale>
    </>
  );
}

function Tool({ label, hint, onPress }: { label: string; hint: string; onPress?: () => void }) {
  return (
    <PressableScale role="button" accessibilityLabel={label} accessibilityHint={hint} disabled={!onPress} onPress={onPress} style={[styles.tool, !onPress && styles.off]}>
      <DsText variant="label" style={font.semiBold}>
        {label}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tool: { minHeight: layout.minTapTarget, paddingHorizontal: space.xs, justifyContent: 'center' },
  off: { opacity: 0.4 },
  done: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
