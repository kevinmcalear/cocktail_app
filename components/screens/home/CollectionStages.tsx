import { Fragment, useRef, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DsText, PopoverMenu, PressableScale, Title, useBreakpoint, useDs, usePopover } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

export interface StageTile<K extends string> {
  key: K;
  n: number;
  label: string;
  /** A muted line under the label: "avg 8.3", "3 ready". */
  sub?: string | null;
}

/**
 * The stage tiles across the top of Collection's Drinks (Had out → To make →
 * Made) and Bars (Want to go → Been), with arrows between. A tile switches
 * the list under it; the page never goes anywhere else.
 */
export function StageStrip<K extends string>({ stages, value, onChange, label }: { stages: StageTile<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  const ds = useDs();
  const desk = useBreakpoint() === 'desktop';
  return (
    <View role="tablist" aria-label={label} style={[styles.strip, desk ? styles.stripDesk : null, { maxWidth: desk ? stages.length * 210 : undefined }]}>
      {stages.map((s, i) => {
        const lit = s.key === value;
        return (
          <Fragment key={s.key}>
            {i ? <IconSymbol name="arrow.right" size={14} color={ds.c.faint} /> : null}
            <PressableScale
              role="tab"
              aria-selected={lit}
              accessibilityLabel={[`${s.n} ${s.label}`, s.sub].filter(Boolean).join(', ')}
              onPress={() => onChange(s.key)}
              style={[styles.cell, { backgroundColor: lit ? ds.c.raised : ds.c.surface, borderColor: lit ? withAlpha(ds.accentText, 0.55) : 'transparent' }]}
            >
              <Title tone={lit ? 'accent' : 'ink'} role={undefined}>
                {String(s.n)}
              </Title>
              <DsText variant="body" style={styles.label} numberOfLines={1}>
                {s.label}
              </DsText>
              {s.sub ? (
                <Caption tone="muted" numberOfLines={1}>
                  {s.sub}
                </Caption>
              ) : null}
            </PressableScale>
          </Fragment>
        );
      })}
    </View>
  );
}

/**
 * How a stage's list is sorted. Pills on a desktop; on a phone, one accent
 * link ("Best first") that opens a menu, as the boards draw them.
 */
export function SortChoice<K extends string>({ options, value, onChange, label }: { options: readonly { value: K; label: string }[]; value: K; onChange: (k: K) => void; label: string }) {
  const ds = useDs();
  const desk = useBreakpoint() === 'desktop';
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  if (desk) {
    return (
      <View role="radiogroup" aria-label={label} style={styles.pills}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={o.value === value} quiet onPress={() => onChange(o.value)} />
        ))}
      </View>
    );
  }
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <View ref={button} collapsable={false}>
      <PressableScale role="button" aria-expanded={!!menu.anchor} accessibilityLabel={`${label}: ${current}`} onPress={() => menu.open(button.current)} style={styles.sort} hitSlop={4}>
        <DsText variant="body" color={ds.accentText} style={styles.label}>
          {current}
        </DsText>
        <IconSymbol name="chevron.down" size={12} color={ds.accentText} />
      </PressableScale>
      <PopoverMenu
        anchor={menu.anchor}
        label={label}
        onClose={menu.close}
        sections={[{ items: options.map((o) => ({ label: o.label, checked: o.value === value, onPress: () => (onChange(o.value), menu.close()) })) }]}
      />
    </View>
  );
}

/** A stage's heading line: its name, and its tools (a sort, a filter) on the right. */
export function StageHead({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <View style={styles.head}>
      {title ? (
        <DsText variant="headline" role="heading">
          {title}
        </DsText>
      ) : null}
      {children}
    </View>
  );
}

/** A desktop table's header row: the column names, each at its width (`null` takes the rest). */
export function TableHead({ cols }: { cols: readonly { label: string; width: number | null; end?: boolean }[] }) {
  const ds = useDs();
  return (
    <View style={[styles.tableHead, { borderBottomColor: ds.c.line }]}>
      {cols.map((c) => (
        <Caption key={c.label} tone="muted" style={[c.width === null ? styles.grow : { width: c.width }, c.end ? styles.end : null]}>
          {c.label}
        </Caption>
      ))}
    </View>
  );
}

export const stageStyles = StyleSheet.create({
  /** A desktop table row: cells side by side with the header's widths. */
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, minWidth: 0 },
  end: { textAlign: 'right' },
  section: { gap: space.xs },
});

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stripDesk: { gap: space.sm },
  cell: { flex: 1, minWidth: 0, paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1 },
  label: { fontWeight: '500' },
  pills: { flexDirection: 'row', gap: space.xs + 2 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 44 },
  tableHead: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1, minWidth: 0 },
  end: { textAlign: 'right' },
});
