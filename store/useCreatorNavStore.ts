import type { SelectedDraftNode } from '@/components/DraftFolderTree';
import { buildNodeFromItem } from '@/lib/creatorWorkspaceUtils';
import { create } from 'zustand';

type PendingCreate = {
  type: 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu';
  barId: string;
};

type CreatorNavState = {
  selectedNode: SelectedDraftNode | null;
  pendingCreate: PendingCreate | null;
  setSelectedNode: (node: SelectedDraftNode | null) => void;
  requestCreate: (type: PendingCreate['type'], barId: string) => void;
  clearPendingCreate: () => void;
};

/** ponytail: web sidebar ↔ Creator Hub selection bridge; no URL sync until deep-links matter */
export const useCreatorNavStore = create<CreatorNavState>((set) => ({
  selectedNode: null,
  pendingCreate: null,
  // create vs select are mutually exclusive — leaving the other set lets edit-mode's
  // storeNode effect reopen the previous menu over a fresh Add Beer/Cocktail/etc.
  setSelectedNode: (node) => set({ selectedNode: node, pendingCreate: null }),
  requestCreate: (type, barId) => set({ pendingCreate: { type, barId }, selectedNode: null }),
  clearPendingCreate: () => set({ pendingCreate: null }),
}));

/** Same path as the sidebar tree: select node, then land on Creator Hub. */
export function openInCreator(
  node: SelectedDraftNode,
  push: (href: '/edit-mode') => void
) {
  useCreatorNavStore.getState().setSelectedNode(node);
  push('/edit-mode');
}

export function openDraftInCreator(
  draft: { id: string; entity_type: string; draft_data?: any },
  push: (href: '/edit-mode') => void
) {
  openInCreator(buildNodeFromItem({ ...draft, isPublished: false }), push);
}