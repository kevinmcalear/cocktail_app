import { ChoiceChips, ControlRow, RowDivider, SelectRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMaxRealRole, useViewAs } from '@/hooks/useViewAs';
import { DEFAULT_SEARCH_ALL, PERSONAL_CONTEXT, resolveDefaultContextIds } from '@/lib/barContextFilter';
import { roleLabel, viewAsOptions } from '@/lib/roles';
import { useAppStore } from '@/store/useAppStore';
import { DEFAULT_UNIT_OPTIONS, THEME_MODES, useSettingsStore } from '@/store/useSettingsStore';

/** How the app looks and behaves on this device. Everything saves as it changes. */
export function PreferencesSection() {
  const bars = useActiveVenue().venues.map((v) => ({ id: v.id, label: v.name }));
  const { themeMode, setThemeMode, defaultSearchContext, setDefaultSearchContext, defaultUnit, setDefaultUnit } = useSettingsStore();
  const setSelectedContextIds = useAppStore((s) => s.setSelectedContextIds);
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving: viewAsSaving } = useViewAs();
  const maxRealRole = useMaxRealRole();
  const viewAsChoices = viewAsOptions(maxRealRole);

  const pickDefaultSearch = (value: string) => {
    setDefaultSearchContext(value);
    setSelectedContextIds(resolveDefaultContextIds(value, bars.map((b) => b.id)));
  };

  return (
    <SettingsSection title="Preferences">
      <ControlRow label="Appearance">
        <ChoiceChips label="Appearance" options={THEME_MODES} value={themeMode} onChange={setThemeMode} />
      </ControlRow>
      <RowDivider />
      <ControlRow label="Default unit" detail="For new recipe ingredients">
        <ChoiceChips label="Default unit" options={DEFAULT_UNIT_OPTIONS} value={defaultUnit} onChange={setDefaultUnit} />
      </ControlRow>
      <RowDivider />
      <SelectRow
        label="Search starts in"
        detail="Which drinks search shows when the app opens"
        options={[{ id: DEFAULT_SEARCH_ALL, label: 'All' }, { id: PERSONAL_CONTEXT, label: 'Personal' }, ...bars]}
        value={defaultSearchContext}
        onChange={pickDefaultSearch}
      />
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
