import { Platform, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';

import { GlassButton } from './Glass';
import { PressableScale } from './PressableScale';
import { useSheetClose } from './sheetClose';
import { Body } from './Text';
import { useDs } from './theme';

export interface FlowHeadProps {
  /** Centred: the flow's name ("Add") or its step ("2 of 3"). */
  title?: string;
  /** The accent tick on the right: true to close the finished flow, or what to run (a Save) before it closes. */
  done?: boolean | (() => void);
  /** The tick shows but can't be pressed yet (a form not filled in). */
  doneDisabled?: boolean;
  /** What the tick says to a screen reader: "Done" unless it saves. */
  doneLabel?: string;
}

/**
 * A whole flow's top row (Prod-rank-A, Prod-motion-sheet, the rota's sheets):
 * Close on the left, an X in a glass circle on iOS and the web and Android's
 * back arrow, as its full-screen dialog has; the title in the middle; the
 * accent tick on the right once there's something to finish. Pass it as a
 * kind="flow" Sheet's header. Close and the tick both close the sheet the way
 * a swipe does (useSheetClose).
 */
export function FlowHead({ title, done, doneDisabled, doneLabel = 'Done' }: FlowHeadProps) {
  const ds = useDs();
  const close = useSheetClose();
  const android = Platform.OS === 'android';
  return (
    <View style={styles.head}>
      <GlassButton accessibilityLabel={android ? 'Back' : 'Close'} icon={android ? 'chevron.left' : 'xmark'} onPress={close} />
      <Body role="heading" style={styles.title} align="center" numberOfLines={1}>
        {title ?? ''}
      </Body>
      {done ? (
        <PressableScale
          role="button"
          accessibilityLabel={doneLabel}
          aria-disabled={!!doneDisabled}
          disabled={doneDisabled}
          onPress={() => {
            if (typeof done === 'function') done();
            close();
          }}
          style={[styles.done, { backgroundColor: ds.accentFill.fill }, doneDisabled && styles.off]}
        >
          <IconSymbol name="checkmark" size={18} color={ds.accentFill.text} />
        </PressableScale>
      ) : (
        <View style={styles.done} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  title: { flex: 1, ...font.semiBold },
  done: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.4 },
});
