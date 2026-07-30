import assert from 'node:assert/strict';

// ponytail: mirrors useCreatorNavStore create↔select mutual exclusion + href helpers
type State = {
  selectedNode: { id: string } | null;
  pendingCreate: { type: string; barId: string } | null;
};

function setSelectedNode(state: State, node: { id: string } | null): State {
  return { ...state, selectedNode: node, pendingCreate: null };
}

function requestCreate(state: State, type: string, barId: string): State {
  return { ...state, pendingCreate: { type, barId }, selectedNode: null };
}

function creatorNodeHref(node: { type: string; id: string }): string {
  return `/edit-mode?type=${encodeURIComponent(node.type)}&id=${encodeURIComponent(node.id)}`;
}

function creatorCreateHref(type: string, barId: string): string {
  return `/edit-mode?create=${encodeURIComponent(type)}&barId=${encodeURIComponent(barId)}`;
}

let s: State = { selectedNode: { id: 'menu-1' }, pendingCreate: null };
s = requestCreate(s, 'beer', 'bar-1');
assert.equal(s.selectedNode, null);
assert.deepEqual(s.pendingCreate, { type: 'beer', barId: 'bar-1' });

s = setSelectedNode(s, { id: 'menu-2' });
assert.deepEqual(s.selectedNode, { id: 'menu-2' });
assert.equal(s.pendingCreate, null);

assert.equal(
  creatorNodeHref({ type: 'menu_draft', id: 'abc/def' }),
  '/edit-mode?type=menu_draft&id=abc%2Fdef'
);
assert.equal(creatorCreateHref('menu', 'personal'), '/edit-mode?create=menu&barId=personal');

console.log('useCreatorNavStore.check: ok');
