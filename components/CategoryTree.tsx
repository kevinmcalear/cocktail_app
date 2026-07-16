import { SpecPillButton } from '@/components/SpecPillButton';
import { LayoutAnimation } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

export type CategoryTreeNode = {
  id: string;
  name: string;
  parent_id: string | null;
};

function hasSelectedDescendant(
  id: string,
  all: CategoryTreeNode[],
  selectedIds: string[]
): boolean {
  const children = all.filter((c) => c.parent_id === id);
  if (children.some((c) => selectedIds.includes(c.id))) return true;
  return children.some((c) => hasSelectedDescendant(c.id, all, selectedIds));
}

function CategoryLayer({
  parentId,
  categories,
  selectedIds,
  onToggle,
}: {
  parentId: string;
  categories: CategoryTreeNode[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const nodes = categories.filter((c) => c.parent_id === parentId);
  if (nodes.length === 0) return null;

  return (
    <YStack gap="$3">
      <XStack flexWrap="wrap" gap="$2">
        {nodes.map((child) => (
          <SpecPillButton
            key={child.id}
            name={child.name}
            selected={selectedIds.includes(child.id)}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onToggle(child.id);
            }}
          />
        ))}
      </XStack>

      {nodes.map((node) => {
        const hasKids = categories.some((c) => c.parent_id === node.id);
        if (!hasKids) return null;
        const expanded =
          selectedIds.includes(node.id) ||
          hasSelectedDescendant(node.id, categories, selectedIds);
        if (!expanded) return null;

        return (
          <YStack
            key={`sub-${node.id}`}
            paddingLeft="$3"
            borderLeftWidth={2}
            borderColor="$color8"
            marginLeft="$2"
            gap="$2"
          >
            <Text
              fontSize={11}
              color="$color11"
              textTransform="uppercase"
              letterSpacing={0.7}
              fontWeight="600"
            >
              {node.name} specifics
            </Text>
            <CategoryLayer
              parentId={node.id}
              categories={categories}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          </YStack>
        );
      })}
    </YStack>
  );
}

/** Hierarchical category picker — roots are section headers, children expand on select. */
export function CategoryTree({
  categories,
  selectedIds,
  onToggle,
}: {
  categories: CategoryTreeNode[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const roots = categories.filter((c) => !c.parent_id);

  return (
    <YStack gap="$5">
      {roots.map((root) => {
        const kids = categories.filter((c) => c.parent_id === root.id);
        if (kids.length === 0) return null;
        return (
          <YStack key={root.id} gap="$3">
            <Text
              fontSize={11}
              fontWeight="600"
              color="$color11"
              letterSpacing={0.7}
              textTransform="uppercase"
            >
              {root.name}
            </Text>
            <CategoryLayer
              parentId={root.id}
              categories={categories}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          </YStack>
        );
      })}
    </YStack>
  );
}
