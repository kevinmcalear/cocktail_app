import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption } from '@/components/ds';
import { RowDivider, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { useBarKit, useSetTools } from '@/hooks/useBarKit';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useKit } from '@/hooks/useKit';
import { EQUIPMENT, equipmentById } from '@/lib/techniques/equipment';
import { toolGroups } from '@/lib/venueKit';

import { VenueSubPage } from './VenueSubPage';

/** Kit: Tools. What's behind the bar and in the prep kitchen, as switches. Anyone with Prep changes it. */
export function KitToolsScreen({ barId }: { barId: string }) {
  const canEdit = (useCapabilities(barId).data ?? []).includes('prep');
  const { data: kit = [], isLoading, error } = useBarKit(barId);
  const set = useSetTools(barId);
  const home = useKit().owned;
  const [all, setAll] = useState(false);
  const have = kit.filter((r) => r.kind === 'tool').map((r) => r.key);
  const fromHome = home.filter((id) => !have.includes(id) && equipmentById(id));

  return (
    <VenueSubPage barId={barId} title="Tools" intro="What’s behind the bar and in the prep kitchen. Make mode checks a house prep against it and says which tool you don’t have.">
      {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
      {error ? <Body tone="muted">Couldn’t load the tools. Check your connection and try again.</Body> : null}
      {canEdit && fromHome.length ? (
        <Button
          label={`Start from your own kit (${fromHome.length} ${fromHome.length === 1 ? 'tool' : 'tools'} at home)`}
          variant="ghost"
          size="sm"
          onPress={() => set.mutate({ ids: fromHome, on: true })}
          style={styles.start}
        />
      ) : null}
      {!isLoading && !error
        ? toolGroups(have, all).map((g) => (
            <SettingsSection key={g.title} title={g.title}>
              {g.ids.map((id, i) => {
                const tool = equipmentById(id)!;
                return (
                  <View key={id}>
                    {i > 0 ? <RowDivider /> : null}
                    <SwitchRow label={tool.name} detail={tool.what} value={have.includes(id)} disabled={!canEdit} onValueChange={(on) => set.mutate({ ids: [id], on })} />
                  </View>
                );
              })}
            </SettingsSection>
          ))
        : null}
      {set.error ? <Caption tone="accent">Couldn’t save that. Check your connection and try again.</Caption> : null}
      {!isLoading && !error ? (
        <Button label={all ? 'Fewer tools' : `All ${EQUIPMENT.length} tools`} variant="ghost" size="sm" onPress={() => setAll(!all)} style={styles.start} />
      ) : null}
      {!canEdit ? <Caption tone="muted">You can look, but changing the kit needs Prep at this venue.</Caption> : null}
    </VenueSubPage>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start', marginVertical: -space.xs },
});
