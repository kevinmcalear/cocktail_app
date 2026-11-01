import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, DsText, Headline, Sheet } from '@/components/ds';
import { space } from '@/constants/tokens';

import { ChoiceRows, SettingsRow, type Choice } from './SettingsParts';

/**
 * Units as a row that opens its own sheet (Sta-units): the row shows the unit
 * in use, the sheet says whose it is and lists the choices. The bar's Units
 * and your own use it. Picking saves or marks the page changed at once; Done
 * only closes.
 */
export function UnitsRow({ intro, options, value, unit, onChange, disabled, icon }: {
  /** Under the title: whose unit this is. */
  intro?: string;
  options: readonly Choice<string>[];
  /** Which choice is ticked. */
  value: string;
  /** What the row reads: the unit in use. */
  unit: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  icon?: 'jigger';
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <SettingsRow label="Units" value={unit} icon={icon} role="button" disabled={disabled} onPress={() => setOpen(true)} />
      <Sheet
        visible={open}
        onClose={close}
        accessibilityLabel="Units"
        style={styles.sheet}
        header={
          <View style={styles.head}>
            <Headline role="heading">Units</Headline>
            <Button label="Done" variant="ghost" size="sm" onPress={close} />
          </View>
        }
      >
        {intro ? (
          <DsText variant="label" tone="muted" style={styles.intro}>
            {intro}
          </DsText>
        ) : null}
        <ChoiceRows label="Units" options={options} value={value} onChange={onChange} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intro: { paddingBottom: space.md },
});
