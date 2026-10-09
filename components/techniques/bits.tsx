import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { missingKit, type Grade, type Source, type Technique } from '@/lib/techniques';

const GRADE: Record<Grade, { label: string; long: string }> = {
  A: { label: 'Well tested', long: 'A primary or tested source' },
  B: { label: 'One good source', long: 'One bar or maker source, or good sources that differ a little' },
  C: { label: 'Starting point', long: 'Not tested at the bar yet: taste and adjust' },
};

/** How far to trust a number. Words, not a letter, so it reads without a key. */
export function GradeTag({ grade }: { grade: Grade }) {
  return <Tag label={GRADE[grade].label} tone={grade === 'C' ? 'warning' : 'default'} />;
}

export function gradeLong(grade: Grade) {
  return GRADE[grade].long;
}

/** A heading over a block of a page. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Caption tone="muted" role="heading" style={styles.eyebrow}>
        {title.toUpperCase()}
      </Caption>
      {children}
    </View>
  );
}

/** One technique in a list: what it is, how long, and what kit it still needs. */
export function TechniqueRow({ t, kit }: { t: Technique; kit: ReadonlySet<string> }) {
  const ds = useDs();
  const router = useRouter();
  // Until you've said what you have, list the kit plainly; after, flag only what's missing.
  const missing = kit.size ? missingKit(t, kit) : [];
  const needs = kit.size ? missing : missingKit(t, new Set());
  const detail = [t.time, needs.length ? `${missing.length ? 'Needs' : 'Kit:'} ${needs.join(', ')}` : null].filter(Boolean).join(' · ');
  return (
    <PressableScale role="link" accessibilityLabel={`${t.name}. ${t.summary} ${detail}`} onPress={() => router.push(`/techniques/${t.id}` as never)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Headline>{t.name}</Headline>
        <Body tone="muted">{t.summary}</Body>
        <Caption tone={missing.length ? 'accent' : 'muted'}>{detail}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** A tappable row that opens another screen in the library. */
export function LinkRow({ title, detail, href, icon }: { title: string; detail?: string; href: string; icon?: Parameters<typeof IconSymbol>[0]['name'] }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale role="link" accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={() => router.push(href as never)} style={[styles.card, { backgroundColor: ds.c.surface }]}>
      {icon ? <IconSymbol name={icon} size={20} color={ds.c.ink} /> : null}
      <View style={styles.flex}>
        <Headline>{title}</Headline>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** Where a number came from, opening the page. */
export function SourceList({ sources }: { sources: Source[] }) {
  const ds = useDs();
  return (
    <View>
      {sources.map((s) => (
        <PressableScale key={s.url} role="link" accessibilityLabel={`${s.name}, ${GRADE[s.grade].label}. Opens the source`} onPress={() => void Linking.openURL(s.url)} style={[styles.source, { borderBottomColor: ds.c.line }]}>
          <Body style={styles.flex}>{s.name}</Body>
          <GradeTag grade={s.grade} />
        </PressableScale>
      ))}
    </View>
  );
}

/** A bulleted note list (watch-outs, swaps). */
export function Notes({ items, icon = 'exclamationmark.triangle' }: { items: string[]; icon?: Parameters<typeof IconSymbol>[0]['name'] }) {
  const ds = useDs();
  return (
    <View style={styles.notes}>
      {items.map((n) => (
        <View key={n} style={styles.note}>
          <IconSymbol name={icon} size={16} color={ds.c.muted} />
          <Body style={styles.flex}>{n}</Body>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  eyebrow: { letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  notes: { gap: space.sm },
  note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
