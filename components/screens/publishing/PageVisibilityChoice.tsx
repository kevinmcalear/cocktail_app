import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { PAGE_COPY, PAGE_VISIBILITIES, type PageVisibility } from '@/lib/pageVisibility';

import { Choice } from '../menus/MenuSheet';
import { RadioCard } from './RadioCard';

interface PageVisibilityChoiceProps {
  venueName: string;
  value: PageVisibility;
  onChange: (value: PageVisibility) => void;
  disabled?: boolean;
  error?: string | null;
  /** False on its own page or a setup step, where the title and intro say it. */
  heading?: boolean;
  /** The line under the choice: setup says where the page stands today. */
  note?: string;
  /** Publishing's own look: radio cards with the radio at the start. */
  radios?: boolean;
  /** Private needs a verified claim (public.bar_claim_verified); until then it's shown, closed. */
  privateAllowed?: boolean;
}

/**
 * "Who sees your page": Private, Names, Menu or Open, for people
 * outside the venue, with what a guest will see. The database keeps the
 * specs back; each drink's own setting still applies below Open.
 */
export function PageVisibilityChoice({ venueName, value, onChange, disabled, error, heading = true, note, radios, privateAllowed = true }: PageVisibilityChoiceProps) {
  const Option = radios ? RadioCard : Choice;
  const ds = useDs();
  return (
    <View style={styles.group}>
      {heading ? <Headline role="heading">Who sees your page</Headline> : null}
      {heading ? <Caption tone="muted">{`Choose what people who don’t work at ${venueName} can see. Your team can always see everything.`}</Caption> : null}
      <View role="radiogroup" accessibilityLabel="Who sees your page" style={styles.rows}>
        {PAGE_VISIBILITIES.map((v) => {
          const closed = v === 'private' && !privateAllowed;
          const detail = closed ? `${PAGE_COPY[v].detail} Opens once your claim is verified.` : PAGE_COPY[v].detail;
          return <Option key={v} label={PAGE_COPY[v].label} detail={detail} selected={value === v} disabled={disabled || closed} onPress={() => onChange(v)} />;
        })}
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
      <Caption tone="muted">{note ?? 'Any single drink can still be kept private from its own page. You can change this once every 30 days.'}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  rows: { gap: space.sm },
  preview: { gap: space.xs, padding: space.lg, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, borderCurve: 'continuous', marginTop: space.sm },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
});
