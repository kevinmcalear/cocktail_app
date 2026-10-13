import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { StaffLinkCard } from '@/components/bar/StaffLinkCard';
import { VenueBasics } from '@/components/bar/VenueBasics';
import { VenueFeatures } from '@/components/bar/VenueFeatures';
import { VenueHoursEditor } from '@/components/bar/VenueHoursEditor';
import { VenueSettingsLinks, VenueTeamLinks } from '@/components/bar/VenueSettingsLinks';
import { BackbarTheme, Body, Caption, Surface, useDs } from '@/components/ds';
import { RowDivider, SelectRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBarEditor } from '@/hooks/useBarEditor';
import type { EditorChromeState } from '@/lib/editorChrome';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';

const LEVEL_CHOICES = ROLE_LEVELS.map((r) => ({ id: String(r.level), label: roleLabel(r.level) }));

interface BarInlineEditorProps {
    barId: string;
    onClose?: () => void;
    onChromeState?: (state: EditorChromeState | null) => void;
    /** Skip own ScrollView when nested in a parent scroller (the venue settings page). */
    embedded?: boolean;
}

export function BarInlineEditor(props: BarInlineEditorProps) {
    // Settings and the creator workspace aren't Back Bar screens yet; this
    // brings the fonts and colours with it.
    return (
        <BackbarTheme>
            {/* Keyed so a different venue starts from its own saved values. */}
            <BarEditorBody key={props.barId} {...props} />
        </BackbarTheme>
    );
}

function BarEditorBody({ barId, onClose, onChromeState, embedded = false }: BarInlineEditorProps) {
    const ds = useDs();
    const editor = useBarEditor(barId);
    const saveRef = useRef(editor.handleSave);
    const discardRef = useRef(editor.discardChanges);
    const onCloseRef = useRef(onClose);

    saveRef.current = editor.handleSave;
    discardRef.current = editor.discardChanges;
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!onChromeState || editor.loading) return;
        onChromeState({
            save: async () => {
                await saveRef.current();
            },
            cancel: () => {
                discardRef.current();
                onCloseRef.current?.();
            },
            saving: editor.saving,
            isDirty: editor.isDirty,
        });
        return () => onChromeState(null);
    }, [onChromeState, editor.loading, editor.saving, editor.isDirty]);

    if (editor.loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={ds.c.ink} />
            </View>
        );
    }

    const disclosure = [
        ['General visibility', 'Who sees the drink at all', editor.visibilityLevel, editor.setVisibilityLevel],
        ['Generic ingredients', '“Gin”, not the brand', editor.genericLevel, editor.setGenericLevel],
        ['Specific brands', '“Fords Gin”', editor.specificLevel, editor.setSpecificLevel],
        ['Measurements', 'Amounts and units', editor.measurementLevel, editor.setMeasurementLevel],
        ['Prep instructions', 'How each line is made', editor.prepLevel, editor.setPrepLevel],
    ] as const;

    const body = (
        <View style={styles.body}>
            {/* On a page of its own (embedded), the header already says the role. */}
            {embedded ? (
                editor.canEdit ? null : <Caption tone="muted">Only Admins can change venue settings.</Caption>
            ) : (
                <Surface raised style={styles.access}>
                    <IconSymbol name="person.circle.fill" size={24} color={ds.c.muted} />
                    <View style={styles.fill}>
                        <Caption tone="muted">Your access level</Caption>
                        <Body>{roleLabel(editor.roleLevel)}</Body>
                        {!editor.canEdit ? (
                            <Caption tone="muted">Admin role required to edit venue settings.</Caption>
                        ) : null}
                    </View>
                </Surface>
            )}

            <VenueBasics editor={editor} barId={barId} />
            <VenueHoursEditor barId={barId} canEdit={editor.canEdit} />
            {editor.slug ? <StaffLinkCard slug={editor.slug} venueName={editor.name || 'your venue'} /> : null}

            <SettingsSection title="Who sees what" note="The lowest role that sees each part of a drink, unless the drink sets its own. Only your team: the public is under Publishing.">
                {disclosure.map(([label, detail, value, setValue], i) => (
                    <View key={label}>
                        {i > 0 ? <RowDivider /> : null}
                        <SelectRow label={label} detail={detail} options={LEVEL_CHOICES} value={value} onChange={setValue} disabled={!editor.canEdit} />
                    </View>
                ))}
            </SettingsSection>

            {/* Only Admins see the switches: everyone else just sees the tabs they give. */}
            {editor.canEdit ? <VenueFeatures barId={barId} /> : null}

            <VenueTeamLinks barId={barId} barName={editor.name || 'This venue'} role={editor.roleLevel} />
            <VenueSettingsLinks barId={barId} />
        </View>
    );

    if (embedded) return body;

    return (
        <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {body}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl },
    body: { gap: space.xl },
    scroll: { padding: space.xl },
    access: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
