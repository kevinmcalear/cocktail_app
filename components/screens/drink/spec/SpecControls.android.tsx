import { Box, DropdownMenuGroup, DropdownMenuItem, DropdownMenuPopup, Host, Icon, SelectableDropdownMenuItem, Spacer, Text } from '@expo/ui/jetpack-compose';
import { height as heightOf, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ConnectedButtons } from '@/components/ds/ConnectedButtons';
import { DsText, PressableScale, useDs } from '@/components/ds';
import { material } from '@/constants/material';
import { font, radius, space } from '@/constants/tokens';
import { SPEC_VIEWS, type SpecView } from '@/lib/specView';

import { useItemTones } from '../MaterialBar.android';

const CHECK = require('@/assets/icons/android/check.xml');

export interface SpecControlsProps {
  view: SpecView;
  onView: (view: SpecView) => void;
  /** After "Makes" on the pill: "1" for a drink, "1 L" for a house-made. */
  makes: string;
  /** The menu's sizes ("Makes 2", "Makes 750 ml"); the picked one is checked. */
  sizes: { key: string; label: string }[];
  picked: string;
  onPick: (key: string) => void;
  /** Their own group under the sizes: "A batch…" (the Batch sheet); a house-made's ways into Make mode. */
  more?: { label: string; onPress: () => void }[];
}

/**
 * Android's spec controls (And-kit-hybrid, And-who-bartender-menu): the
 * connected group, and Makes as a tonal button whose menu is the system's own
 * (@expo/ui's Material 3 Expressive menu). The open button squares off and
 * fills; A batch… (or a house-made's From what I have…) sits in its own group.
 */
export function SpecControls({ view, onView, makes, sizes, picked, onPick, more }: SpecControlsProps) {
  const ds = useDs();
  const tones = useItemTones();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ink = open ? tones.onPrimary : ds.c.ink;
  const groups = more?.length ? 2 : 1;
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
                {sizes.map((s, i) => (
                  <SelectableDropdownMenuItem
                    key={s.key}
                    selected={s.key === picked}
                    shapes={{ index: i, count: sizes.length }}
                    colors={item}
                    onClick={() => {
                      onPick(s.key);
                      close();
                    }}
                  >
                    <SelectableDropdownMenuItem.Text>
                      <Text style={material.menuText}>{s.label}</Text>
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
              {more?.length ? (
                <>
                  <Spacer modifiers={[heightOf(2)]} />
                  <DropdownMenuGroup shapes={{ index: 1, count: groups }} containerColor={tones.menu} modifiers={[width(MENU_WIDTH)]}>
                    {more.map((m) => (
                      <DropdownMenuItem
                        key={m.label}
                        elementColors={{ textColor: ds.c.ink }}
                        onClick={() => {
                          close();
                          m.onPress();
                        }}
                      >
                        <DropdownMenuItem.Text>
                          <Text style={material.menuText}>{m.label}</Text>
                        </DropdownMenuItem.Text>
                        <DropdownMenuItem.LeadingIcon>
                          <Spacer modifiers={[size(CHECK_SIZE, CHECK_SIZE)]} />
                        </DropdownMenuItem.LeadingIcon>
                      </DropdownMenuItem>
                    ))}
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
