import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { BrandColors, VenueIdentity } from '@/components/bar/BarBrandFields';
import { BarSection, ChipGroup, RowDivider } from '@/components/bar/BarParts';
import { StaffLinkCard } from '@/components/bar/StaffLinkCard';
import { VenueSettingsLinks } from '@/components/bar/VenueSettingsLinks';
import { BackbarTheme, Body, Caption, Surface, useDs } from '@/components/ds';
import { TeamRoster } from '@/components/screens/team/TeamRoster';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBarEditor } from '@/hooks/useBarEditor';
import type { EditorChromeState } from '@/lib/editorChrome';
import { roleLabel } from '@/lib/roles';

interface BarInlineEditorProps {
    barId: string;
    onClose?: () => void;
    onChromeState?: (state: EditorChromeState | null) => void;
    /** Skip own ScrollView when nested in a parent scroller (e.g. Settings). */
    embedded?: boolean;
}

export function BarInlineEditor(props: BarInlineEditorProps) {
    // Settings and the creator workspace aren't Back Bar screens yet; this
    // brings the fonts and colours with it.
    return (
        <BackbarTheme>
            <BarEditorBody {...props} />
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

    const levels = editor.roleOptions.map((o) => ({ value: o.value, label: o.name }));
    const disclosure = [
        ['General visibility', editor.visibilityLevel, editor.setVisibilityLevel],
        ['Generic ingredients', editor.genericLevel, editor.setGenericLevel],
        ['Specific brands', editor.specificLevel, editor.setSpecificLevel],
        ['Measurements', editor.measurementLevel, editor.setMeasurementLevel],
        ['Prep instructions', editor.prepLevel, editor.setPrepLevel],
    ] as const;

    const body = (
        <View style={styles.body}>
            <VenueIdentity editor={editor} />
            <BrandColors editor={editor} barId={barId} />

            {editor.slug ? <StaffLinkCard slug={editor.slug} venueName={editor.name || 'your venue'} /> : null}

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

            <BarSection title="Progressive disclosure defaults" note="The lowest role that sees each part of a drink, unless the drink sets its own.">
                {disclosure.map(([label, value, setValue], i) => (
                    <View key={label} style={styles.group}>
                        {i > 0 ? <RowDivider /> : null}
                        <Caption>{label}</Caption>
                        <ChipGroup label={label} options={levels} value={value} onPick={setValue} disabled={!editor.canEdit} />
                    </View>
                ))}
            </BarSection>

            <VenueSettingsLinks barId={barId} />
            <TeamRoster barId={barId} barName={editor.name || 'this venue'} role={editor.roleLevel} />

            <BarSection title={`Assigned items (${editor.items.length})`}>
                {editor.items.length > 0 ? (
                    editor.items.map((item, i) => (
                        <View key={item.id} style={styles.group}>
                            {i > 0 ? <RowDivider /> : null}
                            <Body>{item.name}</Body>
                            <Caption tone="muted" style={styles.capitalize}>{item.item_type}</Caption>
                        </View>
                    ))
                ) : (
                    <Caption tone="muted">No items assigned to this venue yet.</Caption>
                )}
            </BarSection>
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
    group: { gap: space.sm },
    capitalize: { textTransform: 'capitalize' },
});
