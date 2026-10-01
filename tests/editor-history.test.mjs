import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorHistory } from '../src/editor-history.ts';

test('a complete drag or slider gesture undoes in one step with independent snapshots', () => {
  const history = new EditorHistory();
  const draft = { light: { intensity: 20 }, x: 10 };
  history.reset(draft);
  draft.x = 11; history.record(draft, 'drag');
  draft.x = 35; history.record(draft, 'drag');
  history.endGroup();
  draft.light.intensity = 80; history.record(draft, 'light');
  assert.deepEqual(history.undo(), { light: { intensity: 20 }, x: 35 });
  assert.deepEqual(history.undo(), { light: { intensity: 20 }, x: 10 });
  assert.deepEqual(history.redo(), { light: { intensity: 20 }, x: 35 });
  assert.equal(history.canRedo, true);
});
test('editing after undo discards the old redo branch and unchanged selections add no entries', () => {
  const history = new EditorHistory();
  history.reset({ x: 1 }); history.record({ x: 2 }); history.undo();
  history.record({ x: 3 }); history.record({ x: 3 });
  assert.equal(history.canRedo, false);
  assert.deepEqual(history.undo(), { x: 1 });
  assert.equal(history.canUndo, false);
});
test('history stays bounded and reopening an editor clears the prior session', () => {
  const history = new EditorHistory(); history.reset(0);
  for (let value = 1; value <= 100; value++) history.record(value);
  let count = 0; while (history.canUndo) { history.undo(); count++; }
  assert.equal(count, 80);
  history.reset({ x: 4 }); assert.equal(history.canRedo, false); assert.equal(history.canUndo, false);
});
