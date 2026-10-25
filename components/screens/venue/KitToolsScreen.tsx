import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, EquipmentThumb, useDs } from '@/components/ds';
import { KitItemPage } from '@/components/screens/kit/KitItemPage';
import { KitList } from '@/components/screens/kit/KitList';
import { KitPage, useCloseKitItem, useOpenKitItem } from '@/components/screens/kit/KitPage';
import { ToolSheet } from '@/components/screens/kit/ToolSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius } from '@/constants/tokens';
import { useBarKit, useRemoveTool, type KitRow } from '@/hooks/useBarKit';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { equipmentById } from '@/lib/techniques/equipment';
import { kitLine, kitSourceLine, TOOL_LOCATION_LABEL, toolName } from '@/lib/venueKit';

const where = (t: KitRow) => (t.location === 'bar' || t.location === 'prep' ? TOOL_LOCATION_LABEL[t.location] : null);

/** "Prep kitchen · bought from Harbour Supply", "Behind the bar · 6". */
const toolLine = (t: KitRow) => kitLine([where(t), t.count ? String(t.count) : null, kitSourceLine(t)]);

/**
 * Kit: Tools (Kit and ice, steps 1 to 3). What's behind the bar and in the
 * prep kitchen, as a list with Add: ours by key or the venue's own by name,
 * where each is and where it came from. Anyone with Prep changes it.
 */
export function KitToolsScreen({ barId, openId }: { barId: string; openId?: string | null }) {
  const canEdit = (useCapabilities(barId).data ?? []).includes('prep');
  const { data: tools = [], isLoading, error } = useBarKit(barId);
  const open = useOpenKitItem(barId, 'tools', openId);
  const [sheet, setSheet] = useState<{ tool: KitRow | null; startAt: 0 | 1 | 2 } | null>(null);
  const opened = openId ? (tools.find((t) => t.id === openId) ?? null) : null;

  const list = error ? (
    <Body tone="muted">Couldn’t load the tools. Check your connection and try again.</Body>
  ) : isLoading ? (
    <Caption tone="muted">Loading…</Caption>
  ) : (
    <KitList
      sections={[{ entries: tools.map((t) => ({ id: t.id, name: toolName(t), line: toolLine(t), thumb: <ToolThumb tool={t} /> })) }]}
      openId={openId}
      onOpen={open}
      addLabel="Add a tool"
      onAdd={canEdit ? () => setSheet({ tool: null, startAt: 0 }) : undefined}
      empty="No tools listed yet."
    />
  );

  return (
    <>
      <KitPage
        barId={barId}
        kind="tools"
        title="Tools"
        intro="What’s behind the bar and in the prep kitchen. Drinks, what you make in-house and ice recipes are checked against it."
        openId={openId}
        openName={opened ? toolName(opened) : null}
        loading={isLoading}
        failed={!!error}
        list={list}
        item={opened ? <ToolPage barId={barId} tool={opened} canEdit={canEdit} onChange={(startAt) => setSheet({ tool: opened, startAt })} /> : null}
      />
      <ToolSheet barId={barId} visible={!!sheet} tool={sheet?.tool} startAt={sheet?.startAt} onClose={() => setSheet(null)} />
    </>
  );
}

/** Ours drawn; the venue's own a plain mark. */
function ToolThumb({ tool, size = 48 }: { tool: KitRow; size?: number }) {
  const ds = useDs();
  if (tool.key && equipmentById(tool.key)) return <EquipmentThumb id={tool.key} name={toolName(tool)} size={size} />;
  return (
    <View aria-hidden style={[styles.own, { width: size, height: size, backgroundColor: ds.c.paper }]}>
      <IconSymbol name="hammer.fill" size={size / 2.4} color={ds.c.muted} />
    </View>
  );
}

/** One tool, opened (step 2): where it is and where it came from. */
function ToolPage({ barId, tool, canEdit, onChange }: { barId: string; tool: KitRow; canEdit: boolean; onChange: (startAt: 0 | 1 | 2) => void }) {
  const wide = useIsWideWeb();
  const close = useCloseKitItem(barId, 'tools');
  const remove = useRemoveTool(barId);
  const ours = tool.key ? equipmentById(tool.key) : undefined;
  const change = (at: 0 | 1 | 2) => (canEdit ? () => onChange(at) : undefined);
  return (
    <KitItemPage
      kind="Tools"
      name={toolName(tool)}
      showTitle={wide}
      thumb={<ToolThumb tool={tool} size={72} />}
      facts={[
        ...(ours ? [{ label: 'What it does', value: ours.what }] : []),
        { label: 'Where it is', value: [where(tool), tool.count ? `${tool.count} of them` : null].filter(Boolean).join(' · ') || 'Not said yet', onChange: change(2) },
        { label: 'Where it comes from', value: kitSourceLine(tool) || 'Not said yet', onChange: change(1) },
      ]}
      onEdit={change(0)}
      onRemove={canEdit ? () => remove.mutate(tool.id, { onSuccess: close }) : undefined}
      removing={remove.isPending}
      error={remove.error ? 'Couldn’t remove it. Check your connection and try again.' : null}
    />
  );
}

const styles = StyleSheet.create({
  own: { borderRadius: radius.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
