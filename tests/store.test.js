import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';

test('each kid keeps separate progress', () => {
  const a = store.addProfile('Aarav');
  store.addStars(3);
  store.recordPractice('add', { firstTry: true, right: true });
  const m = store.addProfile('Maya');
  assert.equal(store.get().stars, 0);
  assert.deepEqual(store.get().topics, {});
  store.switchTo(a);
  assert.equal(store.get().stars, 3);
  assert.equal(store.get().topics.add.firstTry, 1);
  assert.throws(() => store.addProfile(' aarav '), /already a profile called Aarav/);
  store.renameProfile(m, 'Maya P');
  store.deleteProfile(a);
  assert.equal(store.current().name, 'Maya P');
});
