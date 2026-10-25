import { StyleSheet, View } from 'react-native';

import { Body, Button, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { WizardLine } from '@/lib/drinkWizard';
import { houseName, houseWord } from '@/lib/makeItHouse';

/** A spec line that matched nothing in the catalog, and nobody has said what it is yet. */
export const unmatched = (l: WizardLine) => !l.id && !l.prep && !l.technique && !l.later && !l.bottle && !l.batch && !l.combined && !l.named;

interface LineChoicesProps {
  line: WizardLine;
  /** The venue the drink is for ("Not at Little Rye yet"); null at home. */
  venueName: string | null;
  /** Make it in-house, by the name without "house" ("Miso banana liqueur"): its recipe opens one level down. */
  onMake: (name: string) => void;
  onBottle: () => void;
  onName: () => void;
}

/**
 * Under a typed or pasted line that matched nothing (owner-setup-path, step
 * 10): it says so, and asks what it is. Make it in-house leads only when
 * the line says "house", "homemade" or "in-house"; otherwise A bottle we buy
 * does (call 12).
 */
export function LineChoices({ line, venueName, onMake, onBottle, onName }: LineChoicesProps) {
  const ds = useDs();
  const said = houseWord(line.name);
  const house = !!said;
  const where = venueName ? `Not at ${venueName} yet.` : 'Nothing called that yet.';
  const make = <Button key="make" label="Make it in-house" size="sm" variant={house ? 'primary' : 'secondary'} accessibilityLabel={`Make ${houseName(line.name)} in-house`} accessibilityHint="Opens its recipe, then comes back here" onPress={() => onMake(houseName(line.name))} />;
  const bottle = <Button key="bottle" label={venueName ? 'A bottle we buy' : 'A bottle I buy'} size="sm" variant={house ? 'secondary' : 'primary'} accessibilityLabel={`${line.name} is a bottle ${venueName ? 'we' : 'I'} buy`} onPress={onBottle} />;
  return (
    <View role="group" aria-label={`What ${line.name} is`} style={[styles.box, { backgroundColor: withAlpha(ds.accentText, 0.1), borderColor: withAlpha(ds.accentText, 0.35) }]}>
      <Body>{said ? `${where} It says “${said}”, so:` : `${where} What is it?`}</Body>
      <View style={styles.buttons}>
        {house ? [make, bottle] : [bottle, make]}
        <Button label="Just the name" size="sm" variant="secondary" accessibilityLabel={`Just the name: ${line.name}`} accessibilityHint="Added as new when you save" onPress={onName} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Under the name: past the line's grip and thumb (LineRow's `gripped`).
  box: { marginLeft: space.xl + space.sm + 40 + space.md, gap: space.sm, padding: space.md, borderRadius: radius.control, borderWidth: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
