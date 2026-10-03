import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store, readBackup } from '../js/store.js';

test('progress saved on one device loads on another', () => {
  store.addProfile('Maya');
  store.addStars(5);
  store.recordPractice('times', { firstTry: true, right: true });
  store.addProfile('Leo');
  const file = JSON.stringify(store.exportBackup('1.4.0'));

  // Same app, now pretending to be a device that already has its own "maya" and "Zara".
  for (const p of store.profiles()) store.deleteProfile(p.id);
  store.addProfile('maya');
  store.addProfile('Zara');
  const backup = readBackup(file);
  const preview = store.previewBackup(backup);
  assert.deepEqual(preview.map((p) => [p.name, !!p.replaces]), [['Maya', true], ['Leo', false]]);
  assert.deepEqual(store.loadBackup(backup), { added: 1, replaced: 1 });
  const byName = Object.fromEntries(store.profiles().map((p) => [p.name, p]));
  assert.equal(byName.maya.stars, 5);
  assert.ok(byName.Zara && byName.Leo);
  store.switchTo(byName.maya.id);
  assert.equal(store.get().topics.times.firstTry, 1);
});

test('rejects files that are not progress files', () => {
  assert.throws(() => readBackup('not json'), /isn't a Math Buddy progress file/);
  assert.throws(() => readBackup('{"hello":1}'), /isn't a Math Buddy progress file/);
  assert.throws(() => readBackup('{"app":"math-buddy","format":99,"profiles":[]}'), /newer version/);
  const cleaned = readBackup('{"app":"math-buddy","format":1,"profiles":[{"name":"Ann","data":{"stars":-4,"topics":{"add":{"tries":"3"}}}}]}');
  assert.equal(cleaned.profiles[0].data.stars, 0);
  assert.equal(cleaned.profiles[0].data.topics.add.tries, 3);
});
