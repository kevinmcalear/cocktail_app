import assert from 'node:assert/strict';

// ponytail: mirrors useCreatorNavStore create↔select mutual exclusion
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

let s: State = { selectedNode: { id: 'menu-1' }, pendingCreate: null };
s = requestCreate(s, 'beer', 'bar-1');
assert.equal(s.selectedNode, null);
assert.deepEqual(s.pendingCreate, { type: 'beer', barId: 'bar-1' });

s = setSelectedNode(s, { id: 'menu-2' });
assert.deepEqual(s.selectedNode, { id: 'menu-2' });
assert.equal(s.pendingCreate, null);

console.log('useCreatorNavStore.check: ok');
