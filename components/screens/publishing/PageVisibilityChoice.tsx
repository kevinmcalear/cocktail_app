import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { PAGE_COPY, PAGE_VISIBILITIES, type PageVisibility } from '@/lib/pageVisibility';

import { Choice } from '../menus/MenuSheet';

interface PageVisibilityChoiceProps {
  venueName: string;
  value: PageVisibility;
  onChange: (value: PageVisibility) => void;
  disabled?: boolean;
  error?: string | null;
  /** Inside venue setup, whose step title already asks the question. */
  bare?: boolean;
  /** The line under the choice: setup says where the page stands today. */
  note?: string;
}

/**
 * "Who sees your page": Locked, Names and descriptions, or Open, for people
 * outside the venue, with what a guest will see. The database keeps the
 * specs back; each drink's own setting still applies below Open.
 */
export function PageVisibilityChoice({ venueName, value, onChange, disabled, error, bare, note }: PageVisibilityChoiceProps) {
  const ds = useDs();
  return (
    <View style={styles.group}>
      {bare ? null : (
        <>
          <Headline role="heading">Who sees your page</Headline>
          <Caption tone="muted">{`For people outside ${venueName}. Your team always sees everything.`}</Caption>
        </>
      )}
      <View role="radiogroup" accessibilityLabel="Who sees your page" style={styles.rows}>
        {PAGE_VISIBILITIES.map((v) => (
          <Choice key={v} label={PAGE_COPY[v].label} detail={PAGE_COPY[v].detail} selected={value === v} disabled={disabled} onPress={() => onChange(v)} />
        ))}
      </View>
      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}
      <View style={[styles.preview, { borderColor: ds.c.lineStrong }]} accessible accessibilityLabel={`A guest will see: ${PAGE_COPY[value].preview}`}>
        <Caption tone="muted" style={styles.cap}>
          A guest will see
        </Caption>
        <Body>{PAGE_COPY[value].preview}</Body>
      </View>
      <Caption tone="muted">{note ?? 'Any single drink can still be kept private from its own page.'}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  rows: { gap: space.sm },
  preview: { gap: space.xs, padding: space.lg, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, borderCurve: 'continuous', marginTop: space.sm },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
});
