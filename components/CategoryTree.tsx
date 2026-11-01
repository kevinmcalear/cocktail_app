import { LayoutAnimation, StyleSheet, View } from 'react-native';

import { Caption, Chip, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';

export type CategoryTreeNode = {
  id: string;
  name: string;
  parent_id: string | null;
};

function hasSelectedDescendant(id: string, all: CategoryTreeNode[], selectedIds: string[]): boolean {
  const children = all.filter((c) => c.parent_id === id);
  if (children.some((c) => selectedIds.includes(c.id))) return true;
  return children.some((c) => hasSelectedDescendant(c.id, all, selectedIds));
}

function CategoryLayer({ parentId, categories, selectedIds, onToggle }: { parentId: string; categories: CategoryTreeNode[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  const ds = useDs();
  const nodes = categories.filter((c) => c.parent_id === parentId);
  if (nodes.length === 0) return null;

  return (
    <View style={styles.layer}>
      <View role="group" style={styles.chips}>
        {nodes.map((child) => (
          <Chip
            key={child.id}
            label={child.name}
            multi
            selected={selectedIds.includes(child.id)}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onToggle(child.id);
            }}
          />
        ))}
      </View>
      {nodes.map((node) => {
        const hasKids = categories.some((c) => c.parent_id === node.id);
        const expanded = selectedIds.includes(node.id) || hasSelectedDescendant(node.id, categories, selectedIds);
        if (!hasKids || !expanded) return null;
        return (
          <View key={`sub-${node.id}`} style={[styles.sub, { borderColor: ds.c.lineStrong }]}>
            <Caption tone="muted">{`${node.name} specifics`}</Caption>
            <CategoryLayer parentId={node.id} categories={categories} selectedIds={selectedIds} onToggle={onToggle} />
          </View>
        );
      })}
    </View>
  );
}

/** Hierarchical category picker: roots are section headers, children expand on select. */
export function CategoryTree({ categories, selectedIds, onToggle }: { categories: CategoryTreeNode[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  const roots = categories.filter((c) => !c.parent_id);
  return (
    <View style={styles.tree}>
      {roots.map((root) => {
        if (!categories.some((c) => c.parent_id === root.id)) return null;
        return (
          <View key={root.id} style={styles.layer}>
            <Caption tone="muted" role="heading">
              {root.name}
            </Caption>
            <CategoryLayer parentId={root.id} categories={categories} selectedIds={selectedIds} onToggle={onToggle} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tree: { gap: space.xl },
  layer: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sub: { paddingLeft: space.md, marginLeft: space.sm, borderLeftWidth: 2, gap: space.sm },
});
