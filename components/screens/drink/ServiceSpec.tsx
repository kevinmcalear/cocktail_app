import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, PressableScale, Spec, Tag, useDs } from '@/components/ds';
import { fontFamilies, layout, space } from '@/constants/tokens';
import { bottleLine, isBatchedStyle, SERVICE_STYLES, serviceSpec, serviceStyleLabel, type ServiceLine, type ServiceStyle } from '@/lib/service';
import type { SpecLine } from '@/lib/spec';

interface ServiceSpecProps {
  lines: SpecLine[];
  style: ServiceStyle | null;
  /** This role sees amounts, so it sees the split too (batched drinks only). */
  showLines: boolean;
  canEdit: boolean;
  /** The editor's Service: the five styles and the split are always open to change. */
  inEditor?: boolean;
  onSetLine?: (key: string, atService: boolean) => void;
  onSetStyle?: (style: ServiceStyle | null) => void;
}

/**
 * How the drink goes out, and for batched drinks what goes in the batch and
 * what's added at the station, with the batch pour that follows. We never
 * assume a bar batches: until an editor says how it's served, they're asked,
 * and nobody else sees a split. Editors decide per line (until they do, the
 * split is the same guess Batch makes from the names).
 */
export function ServiceSpec({ lines, style, showLines, canEdit, inEditor = false, onSetLine, onSetStyle }: ServiceSpecProps) {
  const [toggled, setEditing] = useState(false);
  const editing = inEditor || toggled;
  const spec = serviceSpec(lines);
  const styleLabel = serviceStyleLabel(style);
  const batched = isBatchedStyle(style);
  const bottle = bottleLine(spec);
  if (!styleLabel && !canEdit) return null;
  const asking = canEdit && !styleLabel && !inEditor;

  return (
    <View style={styles.block}>
      {asking ? <Body>How does this drink go out? Pick one. Batched drinks show what goes in the batch.</Body> : null}
      {editing || asking ? (
        <View style={styles.styles} role="radiogroup" accessibilityLabel="How it's served">
          {SERVICE_STYLES.map((s) => (
            <Chip key={s.value} label={s.label} selected={s.value === style} onPress={() => onSetStyle?.(s.value === style ? null : s.value)} />
          ))}
        </View>
      ) : styleLabel ? (
        <Tag label={styleLabel} />
      ) : null}
      {batched && showLines ? (
        <>
          <Group title="From the batch" lines={spec.batch} empty="Nothing batched. Every line is made at the station." atStation={false} editing={editing} onSetLine={onSetLine} />
          {spec.pour ? (
            <Body>
              Batch pour <Spec tone="accent">{spec.pour}</Spec>
              {bottle ? <Body tone="muted"> · {bottle.charAt(0).toLowerCase() + bottle.slice(1)}</Body> : null}
            </Body>
          ) : null}
          <Group title="Add at the station" lines={spec.station} empty="Nothing added at the station. Pour and serve." atStation editing={editing} onSetLine={onSetLine} />
          {spec.allGuessed ? (
            <Caption tone="muted">{canEdit ? 'Guessed from the ingredient names. Move any line that\'s wrong and Batch follows.' : 'Guessed from the ingredient names.'}</Caption>
          ) : null}
        </>
      ) : null}
      {canEdit && !asking && !inEditor ? (
        <Button
          label={editing ? 'Done' : batched ? 'Set the batch split' : 'Change how it goes out'}
          variant="secondary"
          accessibilityHint={editing ? undefined : batched ? 'Decide what goes in the batch and how the drink is served' : 'Say how the drink is served'}
          onPress={() => setEditing((e) => !e)}
          style={styles.edit}
        />
      ) : null}
    </View>
  );
}

function Group({
  title,
  lines,
  empty,
  atStation,
  editing,
  onSetLine,
}: {
  title: string;
  lines: ServiceLine[];
  empty: string;
  atStation: boolean;
  editing: boolean;
  onSetLine?: (key: string, atService: boolean) => void;
}) {
  const showAmount = lines.some((l) => l.amount);
  return (
    <View style={styles.group}>
      <Caption tone="muted" style={styles.eyebrow}>
        {title.toUpperCase()}
      </Caption>
      {lines.length === 0 ? <Caption tone="muted">{empty}</Caption> : null}
      {lines.map((l) => (
        <Line key={l.key} line={l} atStation={atStation} editing={editing} showAmount={showAmount} onFlip={onSetLine ? () => onSetLine(l.key, !atStation) : undefined} />
      ))}
    </View>
  );
}

/** One line. While editing, the whole row is a switch that moves it to the other group. */
function Line({ line, atStation, editing, showAmount, onFlip }: { line: ServiceLine; atStation: boolean; editing: boolean; showAmount: boolean; onFlip?: () => void }) {
  const ds = useDs();
  const where = atStation ? 'at the station' : 'in the batch';
  const spoken = [line.amount, line.ingredient, where, line.guessed ? 'guessed' : null].filter(Boolean).join(', ');
  const content = (
    <>
      {showAmount ? (
        <Spec tone="accent" style={styles.amount}>
          {line.amount}
        </Spec>
      ) : null}
      <Body style={styles.name}>{line.ingredient}</Body>
      {/* A guess is said once, under the lines, not on each one (board drink-phone-venue). */}
      {editing ? <Tag label={atStation ? 'Move to batch' : 'Move to station'} /> : null}
    </>
  );
  if (editing && onFlip) {
    return (
      <PressableScale
        role="switch"
        aria-checked={atStation}
        accessibilityLabel={`${line.amount} ${line.ingredient}, ${where}`}
        accessibilityHint={atStation ? 'Move it into the batch' : 'Add it at the station instead'}
        onPress={onFlip}
        style={[styles.row, { borderBottomColor: ds.c.line }]}
      >
        {content}
      </PressableScale>
    );
  }
  return (
    <View accessible accessibilityLabel={spoken} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  group: { gap: space.xs },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 96 },
  name: { flex: 1 },
  edit: { alignSelf: 'flex-start' },
});
