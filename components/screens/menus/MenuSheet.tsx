import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, DsText, PressableScale, Sheet, sheetIsDialog, Title, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

interface MenuSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the scrolling body: the sheet's main action. */
  footer?: ReactNode;
  /** Called once the sheet is on screen. */
  onShow?: () => void;
}

/**
 * A titled sheet with a scrolling body and an optional footer, on the app's
 * one Sheet (components/ds/Sheet): springs up on phones, a dialog on the web.
 */
export function MenuSheet({ visible, onClose, title, subtitle, children, footer, onShow }: MenuSheetProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  return (
    // The negative keyboard offset lets the keyboard cover the footer's home-indicator padding instead of leaving a gap.
    <Sheet
      visible={visible}
      onClose={onClose}
      onShow={onShow}
      accessibilityLabel={title}
      keyboard
      keyboardOffset={footer ? -insets.bottom : 0}
      style={sheetIsDialog ? styles.dialog : undefined}
      header={
        <View style={styles.header}>
          <View style={styles.flex}>
            <Title>{title}</Title>
            {subtitle ? <Caption tone="muted">{subtitle}</Caption> : null}
          </View>
          <SheetCloseButton />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: sheetIsDialog ? space.lg : insets.bottom + space.lg, borderTopColor: ds.c.line }]}>{footer}</View> : null}
    </Sheet>
  );
}

/** The X: closes the sheet it's in the way a drag does, sliding it away first. */
function SheetCloseButton() {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <PressableScale accessibilityLabel="Close" onPress={close} style={styles.close}>
      <IconSymbol name="xmark" size={18} color={ds.c.muted} />
    </PressableScale>
  );
}

interface ChoiceProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** radio: one of a group; checkbox: any number. */
  kind?: 'radio' | 'checkbox';
  detail?: string;
  disabled?: boolean;
}

/** One option in a group: a pill, or a wider row when it has a detail line. */
export function Choice({ label, selected, onPress, kind = 'radio', detail, disabled }: ChoiceProps) {
  const ds = useDs();
  const ink = selected && !detail ? ds.c.ground : ds.c.ink;
  return (
    <PressableScale
      role={kind}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={[
        detail ? styles.row : styles.pill,
        detail
          ? { borderColor: selected ? ds.accentText : ds.c.line, borderWidth: selected ? 2 : 1, backgroundColor: ds.c.ground }
          : { backgroundColor: selected ? ds.c.ink : ds.c.raised },
        disabled && styles.disabled,
      ]}
    >
      {/* Only the full-width row stretches its text; in a content-sized pill,
          flex: 1 collapses the label to nothing on iOS. */}
      <View style={detail ? styles.flex : styles.label}>
        <DsText variant="body" color={ink} style={{ fontFamily: selected ? fontFamilies.bodySemiBold : fontFamilies.body }}>
          {label}
        </DsText>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      {detail ? (
        <View style={[styles.mark, { borderColor: selected ? ds.accentText : ds.c.lineStrong, backgroundColor: selected ? ds.accentText : 'transparent', borderRadius: kind === 'radio' ? radius.pill : radius.mark }]}>
          {selected ? <IconSymbol name="checkmark" size={12} color={ds.c.ground} /> : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  dialog: { paddingTop: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginRight: -space.md },
  body: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, gap: space.md },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  flex: { flex: 1, gap: 2 },
  label: { gap: 2 },
  pill: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  mark: { width: 22, height: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
});
