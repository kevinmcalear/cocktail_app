import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ChoiceChips, ControlRow, RowDivider, SelectRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { UnitsRow } from '@/components/screens/settings/UnitsRow';
import { hasAiConsent, setAiConsent } from '@/lib/aiConsent';
import { appIconChoices, currentAppIcon, setAppIcon } from '@/lib/appIcon';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMaxRealRole, useViewAs } from '@/hooks/useViewAs';
import { roleLabel, viewAsOptions } from '@/lib/roles';
import type { MapsApp } from '@/lib/directions';
import { DEFAULT_UNIT_OPTIONS, THEME_MODES, useSettingsStore } from '@/store/useSettingsStore';

const DIRECTIONS_OPTIONS = [
  { id: 'ask', label: 'Ask each time' },
  { id: 'apple', label: 'Apple Maps' },
  { id: 'google', label: 'Google Maps' },
  { id: 'waze', label: 'Waze' },
];

/** How the app looks and behaves. Everything saves as it changes: View as to the account, the rest to this device. */
export function PreferencesSection() {
  const { themeMode, setThemeMode, units, setUnits, directionsApp, setDirectionsApp } = useSettingsStore();
  // Your bar's unit (bars.spec_unit) is the default; picking one of your own wins over it.
  const active = useActiveVenue().active;
  const bar = active?.unit ? { name: active.name, unit: active.unit } : null;
  // ml, oz and cl as drawn; grams stay for someone already on them.
  const ownUnits = DEFAULT_UNIT_OPTIONS.filter((o) => o.id !== 'g' || units === 'g');
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving: viewAsSaving } = useViewAs();
  const maxRealRole = useMaxRealRole();
  const viewAsChoices = viewAsOptions(maxRealRole);
  // "We ask once. Change it any time in Settings." (Bring in's AI OK.)
  const [ai, setAi] = useState(false);
  // Null on web and on store builds without the icons (dec-28).
  const [iconChoices] = useState(appIconChoices);
  const [icon, setIcon] = useState(currentAppIcon);
  useEffect(() => {
    void hasAiConsent().then(setAi);
  }, []);

  return (
    // The note sits under the card (tools-settings-phone); while View as is on, it says what View as does.
    <SettingsSection
      title="Preferences"
      note={viewAsRoleLevel != null ? 'View as never raises what you can see, only lowers it. The banner stays until you exit, on every screen.' : viewAsChoices.length > 0 ? 'Saved as you change them. View as is saved to your account, the rest on this device.' : 'Saved on this device as you change them.'}
    >
      <ControlRow label="Appearance">
        <ChoiceChips label="Appearance" options={THEME_MODES} value={themeMode} onChange={setThemeMode} />
      </ControlRow>
      <RowDivider />
      <UnitsRow
        intro={bar ? 'Yours wins over the bar’s, on every drink you open.' : undefined}
        options={bar ? [{ id: 'bar', label: 'Like my bar', sub: `${bar.name} uses ${bar.unit}` }, ...ownUnits] : ownUnits}
        value={units ?? (bar ? 'bar' : 'ml')}
        unit={units ?? bar?.unit ?? 'ml'}
        onChange={(id) => setUnits(id === 'bar' ? null : id)}
      />
      <RowDivider />
      <SwitchRow
        label="Read with AI"
        detail="Photos, PDFs and links you bring in are read by Google’s Gemini. Off, we ask again before the next one."
        value={ai}
        onValueChange={(on) => {
          setAi(on);
          void setAiConsent(on);
        }}
      />
      {Platform.OS === 'ios' ? (
        <>
          <RowDivider />
          <SelectRow
            label="Directions"
            detail="The maps app a bar's Directions opens"
            options={DIRECTIONS_OPTIONS}
            value={directionsApp ?? 'ask'}
            onChange={(id) => setDirectionsApp(id === 'ask' ? null : (id as MapsApp))}
          />
        </>
      ) : null}
      {iconChoices ? (
        <>
          <RowDivider />
          <SelectRow
            label="App icon"
            detail="The icon on your home screen"
            options={iconChoices}
            value={icon}
            onChange={(id) => {
              const was = icon;
              setIcon(id);
              setAppIcon(id).catch(() => setIcon(was));
            }}
          />
        </>
      ) : null}
      {viewAsChoices.length > 0 ? (
        <>
          <RowDivider />
          <SelectRow
            label="View as"
            detail="Preview menus and recipes as a lower role"
            disabled={viewAsSaving}
            options={[{ id: 'off', label: `Off (${roleLabel(maxRealRole)})` }, ...viewAsChoices.map(({ level, label }) => ({ id: String(level), label }))]}
            value={viewAsRoleLevel == null ? 'off' : String(viewAsRoleLevel)}
            onChange={(id) => void setViewAsRoleLevel(id === 'off' ? null : Number(id))}
          />
        </>
      ) : null}
    </SettingsSection>
  );
}
