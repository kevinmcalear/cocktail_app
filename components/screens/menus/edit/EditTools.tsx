import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
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

/** Where saving stands (it saves on its own, b27): "Saving…", "Saved", "Not saved" when it couldn't. */
export function saveStatus(editor: LayoutEditor): { text: string; ok: boolean } {
  if (editor.saving || (editor.changed && !editor.error)) return { text: 'Saving…', ok: true };
  if (editor.changed) return { text: 'Not saved', ok: false };
  return { text: editor.savedAt ? 'Saved just now' : 'Saved', ok: true };
}

/** The quiet line with a tick: where saving stands. */
export function SaveLine({ editor }: { editor: LayoutEditor }) {
  const ds = useDs();
  const { text, ok } = saveStatus(editor);
  return (
    <View style={styles.saved} aria-live="polite">
      {ok && text !== 'Saving…' ? <IconSymbol name="checkmark" size={14} color={ds.c.muted} /> : null}
      <Caption tone={ok ? 'muted' : 'accent'}>{text}</Caption>
    </View>
  );
}

/** The editor's tools (Menu-who-creator-edit's toolbar): Add drink, Section, Dates (Night at home, then Share), and Done in ink. */
export function EditTools({ editor, look, onDates, done }: EditViewProps) {
  const ds = useDs();
  const target = addTarget(editor);
  return (
    <>
      <Tool label="Add drink" hint="Add a drink to the menu" onPress={target ? () => editor.setSheet({ kind: 'add', key: target }) : undefined} />
      <Tool label="Section" hint="Add a section" onPress={editor.addSection} />
      {onDates ? <Tool label={look.home ? 'Night' : 'Dates'} hint={look.home ? 'The night and who’s coming' : 'When it goes on'} onPress={onDates} /> : null}
      {look.home ? <Tool label="Share" hint="Share this menu" onPress={editor.saving ? undefined : () => void editor.share()} /> : null}
      <PressableScale role="button" accessibilityLabel={editor.saving ? 'Saving' : 'Done editing'} disabled={editor.saving} onPress={done} style={[styles.done, { backgroundColor: ds.c.ink }, editor.saving && styles.off]}>
        <DsText variant="label" color={ds.c.ground} style={font.semiBold}>
          {editor.saving ? 'Saving…' : 'Done'}
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
  saved: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget },
});
