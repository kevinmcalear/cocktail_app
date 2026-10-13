import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, DsText, GlassButton, Headline, PressableScale, Sheet, sheetIsDialog, SheetScrollView, Title, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

interface MenuSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Small mono caps over the title ("WHERE IT LIVES · LITTLE RYE"), in place of a subtitle under it. */
  eyebrow?: string;
  children: ReactNode;
  /** Pinned under the scrolling body: the sheet's main action. */
  footer?: ReactNode;
  /** Called once the sheet is on screen. */
  onShow?: () => void;
  /** A form's header: Cancel, the title in the middle, and Save, in place of the title and X. */
  save?: { label: string; onPress: () => void; disabled?: boolean };
  /** The form header (Cancel and the title) with no Save: a step of a form whose own button saves. */
  form?: boolean;
  /** A menu of places or actions (New, Switch to): the title in the body face, as the canvas draws those. */
  plain?: boolean;
}

/**
 * A titled sheet with a scrolling body and an optional footer, on the app's
 * one Sheet (components/ds/Sheet): springs up on phones, a dialog on the web.
 */
export function MenuSheet({ visible, onClose, title, subtitle, eyebrow, children, footer, onShow, save, plain, form }: MenuSheetProps) {
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
        save || form ? (
          <FormHeader title={title} save={save} />
        ) : (
          <View style={styles.header}>
            <View style={styles.flex}>
              {eyebrow ? (
                <Caption tone="muted" style={styles.eyebrow}>
                  {eyebrow.toUpperCase()}
                </Caption>
              ) : null}
              {plain ? <Headline role="heading">{title}</Headline> : <Title>{title}</Title>}
              {subtitle ? <Caption tone="muted">{subtitle}</Caption> : null}
            </View>
            <SheetCloseButton />
          </View>
        )
      }
    >
      <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </SheetScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: sheetIsDialog ? space.lg : insets.bottom + space.lg, borderTopColor: ds.c.line }]}>{footer}</View> : null}
    </Sheet>
  );
}

/** The X: closes the sheet it's in the way a drag does, sliding it away first. */
function SheetCloseButton() {
  const close = useSheetClose();
  // A round glass button, as the canvas draws a sheet's close.
  return <GlassButton icon="xmark" accessibilityLabel="Close" onPress={close} />;
}

/** Cancel (closes the way a drag does), the title, and Save. */
function FormHeader({ title, save }: { title: string; save?: MenuSheetProps['save'] }) {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <View style={[styles.header, styles.form]}>
      <PressableScale role="button" onPress={close} style={styles.formButton}>
        <DsText tone="muted">Cancel</DsText>
      </PressableScale>
      <DsText role="heading" numberOfLines={1} style={[styles.formTitle, { fontFamily: fontFamilies.bodySemiBold }]}>
        {title}
      </DsText>
      {save ? (
        <PressableScale role="button" onPress={save.onPress} disabled={save.disabled} style={[styles.formButton, styles.formSave, save.disabled && styles.disabled]}>
          <DsText color={ds.accentText} style={{ fontFamily: fontFamilies.bodySemiBold }}>
            {save.label}
          </DsText>
        </PressableScale>
      ) : (
        <View style={styles.formButton} />
      )}
    </View>
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
  /** A wide row's leading icon, on a raised tile (New menu's start options). */
  icon?: IconName;
  /**
   * A pill's look. Left out: ink when picked, raised otherwise. 'accent': the
   * venue accent when picked, a line otherwise (the builder's library filter).
   * 'outline': ink with a tick when picked, a line otherwise (New menu's saved menus).
   */
  pill?: 'accent' | 'outline';
  /** A wide row without its radio: the card's border and tint say it's picked (New menu's start options). */
  noMark?: boolean;
  /** Under a wide row, inside its card: what the pick opens (New menu's saved menus). */
  children?: ReactNode;
  /** A wide radio row with its dot first, filled in the accent when picked (ppl-bar-visibility, the report sheet). */
  dotFirst?: boolean;
}

/** One option in a group: a pill, or a wider row when it has a detail line. */
export function Choice({ label, selected, onPress, kind = 'radio', detail, disabled, icon, pill, noMark, children, dotFirst }: ChoiceProps) {
  const ds = useDs();
  const accentPill = !detail && pill === 'accent' && selected;
  const ink = accentPill ? ds.accentFill.text : selected && !detail ? ds.c.ground : ds.c.ink;
  const pillLook = accentPill
    ? { backgroundColor: ds.accentFill.fill }
    : pill && !selected
      ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: ds.c.lineStrong }
      : { backgroundColor: selected ? ds.c.ink : ds.c.raised };
  const dot = dotFirst && detail ? <View style={[styles.dot, { borderColor: selected ? ds.accentText : ds.c.lineStrong, borderWidth: selected ? 7 : 2 }]} aria-hidden /> : null;
  const card = { borderColor: selected ? ds.accentText : ds.c.line, borderWidth: selected && !dotFirst ? 2 : 1, backgroundColor: selected && noMark ? withAlpha(ds.accentFill.fill, 0.08) : ds.c.ground };
  const row = (
    <PressableScale
      role={kind}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={[detail ? styles.row : [styles.pill, pill ? styles.pillSmall : null], dot ? styles.dotRow : null, detail ? (children ? null : card) : pillLook, disabled && styles.disabled]}
    >
      {dot}
      {icon && detail ? (
        <View style={[styles.iconTile, { backgroundColor: ds.c.raised }]} aria-hidden>
          <IconSymbol name={icon} size={20} color={ds.c.ink} />
        </View>
      ) : null}
      {pill === 'outline' && selected ? <IconSymbol name="checkmark" size={14} color={ink} /> : null}
      {/* Only the full-width row stretches its text; in a content-sized pill,
          flex: 1 collapses the label to nothing on iOS. */}
      <View style={detail ? styles.flex : styles.label}>
        <DsText variant="body" color={ink} style={{ fontFamily: selected ? fontFamilies.bodySemiBold : fontFamilies.body }}>
          {label}
        </DsText>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      {detail && !noMark && !dot ? (
        <View style={[styles.mark, { borderColor: selected ? ds.accentText : ds.c.lineStrong, backgroundColor: selected ? ds.accentText : 'transparent', borderRadius: kind === 'radio' ? radius.pill : radius.mark }]}>
          {selected ? <IconSymbol name="checkmark" size={12} color={ds.c.ground} /> : null}
        </View>
      ) : null}
    </PressableScale>
  );
  if (!children) return row;
  return (
    <View style={[styles.cardWrap, card]}>
      {row}
      <View style={styles.inside}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: { paddingTop: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md },
  form: { alignItems: 'center', paddingHorizontal: space.md },
  formButton: { minWidth: 72, minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.sm },
  formSave: { alignItems: 'flex-end' },
  formTitle: { flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, gap: space.md },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  flex: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2 },
  label: { gap: 2 },
  pill: { minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  pillSmall: { minHeight: 36, paddingHorizontal: space.md, gap: space.xs + 2 },
  cardWrap: { borderRadius: radius.card, borderCurve: 'continuous' },
  // Under the row's text: past the icon tile (44) and its gap.
  inside: { paddingLeft: space.lg + 44 + space.md, paddingRight: space.lg, paddingBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  iconTile: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 22, height: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 22, height: 22, borderRadius: radius.pill, marginTop: 1 },
  dotRow: { alignItems: 'flex-start', borderRadius: radius.control },
  disabled: { opacity: 0.45 },
});
