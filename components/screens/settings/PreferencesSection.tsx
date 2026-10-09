import { ChoiceChips, ControlRow, RowDivider, SelectRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { useMaxRealRole, useViewAs } from '@/hooks/useViewAs';
import { roleLabel, viewAsOptions } from '@/lib/roles';
import { DEFAULT_UNIT_OPTIONS, THEME_MODES, useSettingsStore } from '@/store/useSettingsStore';

/** How the app looks and behaves on this device. Everything saves as it changes. */
export function PreferencesSection() {
  const { themeMode, setThemeMode, defaultUnit, setDefaultUnit } = useSettingsStore();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving: viewAsSaving } = useViewAs();
  const maxRealRole = useMaxRealRole();
  const viewAsChoices = viewAsOptions(maxRealRole);

  return (
    <SettingsSection title="Preferences">
      <ControlRow label="Appearance">
        <ChoiceChips label="Appearance" options={THEME_MODES} value={themeMode} onChange={setThemeMode} />
      </ControlRow>
      <RowDivider />
      <ControlRow label="Default unit" detail="For new recipe ingredients">
        <ChoiceChips label="Default unit" options={DEFAULT_UNIT_OPTIONS} value={defaultUnit} onChange={setDefaultUnit} />
      </ControlRow>
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
