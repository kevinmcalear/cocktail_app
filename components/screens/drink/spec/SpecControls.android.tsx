import { Box, DropdownMenuGroup, DropdownMenuItem, DropdownMenuPopup, Host, Icon, SelectableDropdownMenuItem, Spacer, Text } from '@expo/ui/jetpack-compose';
import { height as heightOf, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ConnectedButtons } from '@/components/ds/ConnectedButtons';
import { DsText, PressableScale, useDs } from '@/components/ds';
import { material } from '@/constants/material';
import { font, radius, space } from '@/constants/tokens';
import { MAKES, SPEC_VIEWS, type Makes, type SpecView } from '@/lib/specView';

import { useItemTones } from '../MaterialBar.android';

const CHECK = require('@/assets/icons/android/check.xml');

interface SpecControlsProps {
  view: SpecView;
  onView: (view: SpecView) => void;
  makes: Makes;
  onMakes: (makes: Makes) => void;
  /** "A batch…": opens the Batch sheet. Left out where a batch makes no sense (nothing measured). */
  onBatch?: () => void;
}

/**
 * Android's spec controls (And-kit-hybrid, And-who-bartender-menu): the
 * connected group, and Makes as a tonal button whose menu is the system's own
 * (@expo/ui's Material 3 Expressive menu). The open button squares off and
 * fills; A batch… sits in its own group.
 */
export function SpecControls({ view, onView, makes, onMakes, onBatch }: SpecControlsProps) {
  const ds = useDs();
  const tones = useItemTones();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ink = open ? tones.onPrimary : ds.c.ink;
  const groups = onBatch ? 2 : 1;
  const item = { textColor: ds.c.ink, containerColor: tones.menu, selectedTextColor: ds.c.ink, selectedContainerColor: tones.tonal, selectedLeadingIconColor: ds.c.ink };
  return (
    <View style={styles.row}>
      <ConnectedButtons options={SPEC_VIEWS} value={view} onChange={onView} accessibilityLabel="Show the spec as" colors={{ picked: tones.primary, onPicked: tones.onPrimary, rest: tones.tonal, onRest: ds.c.ink }} />
      <View>
        <PressableScale
          role="button"
          aria-haspopup="menu"
          aria-expanded={open}
          accessibilityLabel={`Makes ${makes}. Change how many`}
          onPress={() => setOpen((o) => !o)}
          style={[styles.makes, open ? styles.squared : null, { backgroundColor: open ? tones.primary : tones.tonal }]}
        >
          <DsText color={ink} style={styles.label}>
            Makes {makes}
          </DsText>
          <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
            <Path d={open ? 'M7 14l5-5 5 5z' : 'M7 10l5 5 5-5z'} fill={ink} />
          </Svg>
        </PressableScale>
        {/* The menu anchors to its parent: a strip just under the button (the board's 8 dp gap). */}
        <Host colorScheme={ds.scheme} style={styles.anchor}>
          <Box>
            <DropdownMenuPopup expanded={open} onDismissRequest={close}>
              <DropdownMenuGroup shapes={{ index: 0, count: groups }} containerColor={tones.menu} modifiers={[width(MENU_WIDTH)]}>
                {MAKES.map((n, i) => (
                  <SelectableDropdownMenuItem
                    key={n}
                    selected={n === makes}
                    shapes={{ index: i, count: MAKES.length }}
                    colors={item}
                    onClick={() => {
                      onMakes(n);
                      close();
                    }}
                  >
                    <SelectableDropdownMenuItem.Text>
                      <Text style={material.menuText}>{`Makes ${n}`}</Text>
                    </SelectableDropdownMenuItem.Text>
                    <SelectableDropdownMenuItem.LeadingIcon>
                      <Spacer modifiers={[size(CHECK_SIZE, CHECK_SIZE)]} />
                    </SelectableDropdownMenuItem.LeadingIcon>
                    <SelectableDropdownMenuItem.SelectedLeadingIcon>
                      <Icon source={CHECK} size={CHECK_SIZE} />
                    </SelectableDropdownMenuItem.SelectedLeadingIcon>
                  </SelectableDropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {onBatch ? (
                <>
                  <Spacer modifiers={[heightOf(2)]} />
                  <DropdownMenuGroup shapes={{ index: 1, count: groups }} containerColor={tones.menu} modifiers={[width(MENU_WIDTH)]}>
                    <DropdownMenuItem
                      elementColors={{ textColor: ds.c.ink }}
                      onClick={() => {
                        close();
                        onBatch();
                      }}
                    >
                      <DropdownMenuItem.Text>
                        <Text style={material.menuText}>A batch…</Text>
                      </DropdownMenuItem.Text>
                      <DropdownMenuItem.LeadingIcon>
                        <Spacer modifiers={[size(CHECK_SIZE, CHECK_SIZE)]} />
                      </DropdownMenuItem.LeadingIcon>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenuPopup>
          </Box>
        </Host>
      </View>
    </View>
  );
}

const CHECK_SIZE = 20;
const MENU_WIDTH = 196;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  makes: { height: material.control, paddingLeft: space.lg, paddingRight: space.sm + 2, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 2 },
  squared: { borderRadius: radius.control },
  label: { ...material.label, ...font.medium },
  anchor: { position: 'absolute', left: 0, right: 0, bottom: -space.sm, height: 1 },
});
