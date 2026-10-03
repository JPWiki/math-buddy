import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { createSync } from '../js/sync.js';

// A pretend Firebase: one shared backend, one "device" adapter per store.
function fakeBackend() {
  return { users: {}, families: {}, watchers: new Set() };
}

const clone = (x) => JSON.parse(JSON.stringify(x));

function fakeCloud(backend) {
  let user = null;
  let authCb = () => {};
  const fam = () => (backend.families[user.uid] ||= { kids: {}, progress: {} });
  const notify = (uid) => {
    for (const w of backend.watchers) {
      if (w.uid !== uid) continue;
      const f = backend.families[uid];
      w.onKids(clone(f.kids));
      for (const [id, d] of Object.entries(f.progress)) w.onProgress(id, clone(d));
    }
  };
  const write = (fn) => { fn(fam()); notify(user.uid); return Promise.resolve(); };
  return {
    async signUp(email, pw) {
      if (backend.users[email]) throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' });
      backend.users[email] = { pw, uid: `u${Object.keys(backend.users).length + 1}` };
      user = { uid: backend.users[email].uid, email };
      authCb(user);
    },
    async signIn(email, pw) {
      const u = backend.users[email];
      if (!u || u.pw !== pw) throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
      user = { uid: u.uid, email };
      authCb(user);
    },
    async resetPassword() {},
    async signOut() { user = null; authCb(null); },
    onAuth(cb) { authCb = cb; cb(user); },
    onPending() {},
    async loadFamily() { return clone(fam()); },
    watch(onKids, onProgress) {
      const w = { uid: user.uid, onKids, onProgress };
      backend.watchers.add(w);
      notify(user.uid);
      return () => backend.watchers.delete(w);
    },
    putKid: (id, meta, isNew) => write((f) => { f.kids[id] = { ...f.kids[id], ...meta, ...(isNew ? { order: Date.now() } : {}) }; }),
    deleteKid: (id) => write((f) => { f.kids[id] = { ...f.kids[id], deleted: true }; delete f.progress[id]; }),
    setProgress: (id, d) => write((f) => { f.progress[id] = clone(d); }),
    setHistory: (id, history) => write((f) => { f.progress[id] = { ...f.progress[id], history }; }),
    addProgress: (id, delta) => write((f) => {
      const p = (f.progress[id] ||= { stars: 0, solved: 0, bestStreak: 0, topics: {} });
      p.stars = (p.stars || 0) + (delta.stars || 0);
      p.solved = (p.solved || 0) + (delta.solved || 0);
      if (delta.bestStreak !== undefined) p.bestStreak = delta.bestStreak;
      for (const [k, t] of Object.entries(delta.topics || {})) {
        const s = ((p.topics ||= {})[k] ||= { tries: 0, firstTry: 0, right: 0 });
        s.tries += t.tries || 0; s.firstTry += t.firstTry || 0; s.right += t.right || 0;
      }
    }),
  };
}

function memoryStorage(seed) {
  const m = new Map(seed ? [['math-buddy.v2', JSON.stringify(seed)]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

const settle = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };
const kids = (store) => Object.fromEntries(store.profiles().map((p) => [p.name, p.stars]));

function device(backend, seed, answer = 'cloud') {
  const store = createStore(memoryStorage(seed));
  const asked = [];
  const sync = createSync({ store, cloud: fakeCloud(backend), askConflicts: async (clashes) => {
    asked.push(...clashes);
    return Object.fromEntries(clashes.map((c) => [c.name, answer]));
  } });
  return { store, sync, asked };
}

const maya42 = { id: 'a1', name: 'Maya', color: 1, data: { stars: 42, solved: 29, bestStreak: 9, topics: { times: { tries: 30, firstTry: 25, right: 29 } } } };

test('a family keeps the same progress on every device', async () => {
  const backend = fakeBackend();

  // Phone: has Maya's progress, creates the family account.
  const A = device(backend, { profiles: [maya42], current: 'a1' });
  await A.sync.signUp('family@example.com', 'secret1');
  await settle();
  assert.deepEqual(kids(A.store), { Maya: 42 });
  assert.equal(A.sync.status().state, 'synced');

  // Tablet: had Maya copied over by file earlier (same 42 stars) plus Zara.
  const B = device(backend, { profiles: [{ ...maya42, id: 'b1' }, { id: 'b2', name: 'Zara', color: 2, data: { stars: 5 } }], current: 'b1' });
  await B.sync.signIn('family@example.com', 'secret1');
  await settle();
  assert.equal(B.asked.length, 1, 'asks what to do about Maya');
  assert.deepEqual(kids(B.store), { Maya: 42, Zara: 5 }, 'keeps the family copy, no double counting');
  assert.deepEqual(kids(A.store), { Maya: 42, Zara: 5 }, 'Zara shows up on the phone');

  // Practice on the phone shows up on the tablet.
  A.store.switchTo(A.store.profiles().find((p) => p.name === 'Maya').id);
  A.store.recordPractice('times', { firstTry: true, right: true });
  A.store.addStars(1);
  // At the same time, Maya practices on the tablet too.
  B.store.switchTo(B.store.profiles().find((p) => p.name === 'Maya').id);
  B.store.addStars(1);
  await settle();
  assert.equal(kids(A.store).Maya, 44);
  assert.equal(kids(B.store).Maya, 44);
  assert.equal(B.store.get().topics.times.tries, 31);

  // Rename and delete travel too.
  const zara = B.store.profiles().find((p) => p.name === 'Zara');
  B.store.renameProfile(zara.id, 'Zara P');
  await settle();
  assert.ok('Zara P' in kids(A.store));
  B.store.deleteProfile(zara.id);
  await settle();
  assert.deepEqual(Object.keys(kids(A.store)), ['Maya']);

  // A third device chooses to add its own Maya progress on top.
  const C = device(backend, { profiles: [{ id: 'c1', name: 'maya', color: 0, data: { stars: 10, topics: { add: { tries: 4, firstTry: 3, right: 4 } } } }], current: 'c1' }, 'add');
  await C.sync.signIn('family@example.com', 'secret1');
  await settle();
  assert.equal(kids(C.store).Maya, 54);
  assert.equal(kids(A.store).Maya, 54);
  A.store.switchTo(A.store.profiles()[0].id);
  assert.equal(A.store.get().topics.add.tries, 4);

  // Signing out keeps the progress on that device but stops syncing.
  await B.sync.signOut();
  await settle();
  assert.equal(B.sync.status().state, 'signed-out');
  B.store.addStars(5);
  await settle();
  assert.equal(kids(A.store).Maya, 54);
});

test('progress made while the app is still connecting is kept', async () => {
  const backend = fakeBackend();
  const A = device(backend, { profiles: [maya42], current: 'a1' });
  await A.sync.signUp('family@example.com', 'secret1');
  await settle();
  // Next time the app opens: sync info is saved, but the engine isn't connected yet.
  const saved = new Map();
  const storage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: (k) => saved.delete(k) };
  const famId = Object.keys(backend.families.u1.kids)[0];
  storage.setItem('math-buddy.v2', JSON.stringify({ profiles: [{ id: famId, name: 'Maya', color: 1, data: { stars: 42 } }], current: famId, sync: { uid: 'u1', email: 'family@example.com' } }));
  const store = createStore(storage);
  store.addStars(3); // earned before reconnecting
  const cloud = fakeCloud(backend);
  createSync({ store, cloud });
  await cloud.signIn('family@example.com', 'secret1');
  await settle();
  assert.equal(store.profiles()[0].stars, 45);
  assert.equal(backend.families.u1.progress[famId].stars, 45);
});

test('wrong password and taken email give a clear error code', async () => {
  const backend = fakeBackend();
  const A = device(backend);
  await A.sync.signUp('f@example.com', 'secret1');
  const B = device(backend);
  await assert.rejects(B.sync.signIn('f@example.com', 'nope'), (e) => e.code === 'auth/invalid-credential');
  await assert.rejects(B.sync.signUp('f@example.com', 'x'), (e) => e.code === 'auth/email-already-in-use');
});
