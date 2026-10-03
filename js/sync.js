// Family sync: keeps every kid's progress the same on all of a family's devices.
//
// How it stays correct when several devices are used, even offline:
// - Counts (stars, problems right, topic tries) are sent as "add N" changes, never as
//   totals, so practice on two devices at once adds up instead of overwriting.
// - Names, colors and settings are simply "latest change wins".
// - Each device keeps working from its own saved copy, so the app never waits on the network.
//
// `cloud` is an adapter (js/cloud-firebase.js in the app, an in-memory fake in tests) with:
//   signUp, signIn, resetPassword, signOut, onAuth(cb), loadFamily(), watch(onKids, onProgress),
//   putKid(id, meta, isNew), deleteKid(id), setProgress(id, data), addProgress(id, delta),
//   setHistory(id, history), onPending(cb)

const progressOf = (d) => ({
  stars: d.stars || 0,
  solved: d.solved || 0,
  bestStreak: d.bestStreak || 0,
  topics: d.topics || {},
  history: d.history || [],
});

const hasProgress = (d) => !!d && ((d.stars || 0) > 0 || Object.keys(d.topics || {}).length > 0);

function addTogether(a, b) {
  const topics = { ...a.topics };
  for (const [k, t] of Object.entries(b.topics || {})) {
    const s = topics[k] || { tries: 0, firstTry: 0, right: 0 };
    topics[k] = { tries: s.tries + (t.tries || 0), firstTry: s.firstTry + (t.firstTry || 0), right: s.right + (t.right || 0) };
  }
  return {
    stars: a.stars + (b.stars || 0),
    solved: a.solved + (b.solved || 0),
    bestStreak: Math.max(a.bestStreak, b.bestStreak || 0),
    topics,
    history: [...(a.history || []), ...(b.history || []).filter((h) => !(a.history || []).includes(h))].slice(0, 15),
  };
}

export function createSync({ store, cloud, onChange = () => {}, onStatus = () => {}, askConflicts }) {
  let user = null;
  let unwatch = null;
  let linked = false;
  let pending = 0;
  let state = 'signed-out';
  let error = '';
  const cloudProgress = new Map(); // latest numbers from the family account, by kid id

  const setState = (s, err = '') => {
    state = s;
    error = err;
    onStatus(status());
  };

  function status() {
    return {
      state, // 'signed-out' | 'joining' | 'synced' | 'saving' | 'offline' | 'error'
      email: user ? user.email : (store.syncInfo() || {}).email || null,
      pending,
      error,
    };
  }

  cloud.onPending((n) => {
    pending = n;
    if (!linked) return;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setState(n ? (offline ? 'offline' : 'saving') : 'synced');
  });

  function startWatching() {
    if (unwatch) unwatch();
    unwatch = cloud.watch(
      (kids) => {
        store.applyCloudKids(kids);
        // Progress may have arrived before the kid's name did.
        for (const [id, d] of cloudProgress) store.applyCloudProgress(id, d);
        onChange();
      },
      (id, d) => {
        cloudProgress.set(id, d);
        store.applyCloudProgress(id, d);
        onChange();
      },
      (err) => setState('error', friendlySyncError(err)),
    );
  }

  // First time this device uses the family account: put both sides together.
  async function join() {
    setState('joining');
    const family = await cloud.loadFamily();
    const cloudKids = Object.entries(family.kids || {}).filter(([, m]) => m && !m.deleted && m.name);
    const byName = new Map(cloudKids.map(([id, m]) => [m.name.toLowerCase(), id]));
    const local = store.snapshotKids();
    const clashes = local
      .filter((k) => byName.has(k.meta.name.toLowerCase()) && hasProgress(k.data))
      .map((k) => {
        const id = byName.get(k.meta.name.toLowerCase());
        return { name: k.meta.name, here: k.data.stars || 0, family: (family.progress[id] || {}).stars || 0 };
      });
    const choices = clashes.length && askConflicts ? await askConflicts(clashes) : {};

    const result = cloudKids.map(([id, m]) => ({ id, meta: m, data: progressOf(family.progress[id] || {}) }));
    for (const k of local) {
      const cloudId = byName.get(k.meta.name.toLowerCase());
      if (!cloudId) {
        // A kid the family account doesn't have yet: upload them.
        await cloud.putKid(k.id, k.meta, true);
        await cloud.setProgress(k.id, progressOf(k.data));
        result.push({ id: k.id, meta: k.meta, data: progressOf(k.data) });
      } else if (choices[k.meta.name] === 'add' && hasProgress(k.data)) {
        // Add this device's progress on top of the family account's.
        const delta = progressOf(k.data);
        await cloud.addProgress(cloudId, { stars: delta.stars, solved: delta.solved, topics: delta.topics, bestStreak: delta.bestStreak });
        const r = result.find((x) => x.id === cloudId);
        r.data = addTogether(r.data, delta);
      }
    }
    store.adoptKids(result);
    for (const r of result) cloudProgress.set(r.id, r.data);
  }

  async function link(u) {
    user = u;
    try {
      const info = store.syncInfo();
      if (!info || info.uid !== u.uid) {
        if (info) store.setSyncInfo(null); // a different family account: start fresh
        await join();
        store.setSyncInfo({ uid: u.uid, email: u.email });
      }
      linked = true;
      // Send anything saved while connecting or offline before taking in the family's copy.
      flush();
      startWatching();
      setState(pending ? 'saving' : 'synced');
      onChange();
    } catch (err) {
      linked = false;
      setState('error', friendlySyncError(err));
    }
  }

  function unlink() {
    linked = false;
    user = null;
    if (unwatch) { unwatch(); unwatch = null; }
    cloudProgress.clear();
    setState('signed-out');
  }

  // Changes made on this device wait in the store's outbox; send them once connected.
  function flush() {
    if (!linked) return;
    for (const ev of store.takeOutbox()) send(ev);
  }
  store.on(() => flush());

  function send(ev) {
    const known = cloudProgress.get(ev.id) || {};
    switch (ev.type) {
      case 'kid':
        cloud.putKid(ev.id, ev.meta, !!ev.data);
        if (ev.data) cloud.setProgress(ev.id, progressOf(ev.data));
        break;
      case 'replace':
        cloud.setProgress(ev.id, progressOf(ev.data));
        break;
      case 'delete':
        cloud.deleteKid(ev.id);
        break;
      case 'stars':
        cloud.addProgress(ev.id, { stars: ev.n });
        break;
      case 'practice':
        cloud.addProgress(ev.id, {
          solved: ev.right ? 1 : 0,
          topics: { [ev.topic]: { tries: 1, firstTry: ev.firstTry ? 1 : 0, right: ev.right ? 1 : 0 } },
          bestStreak: ev.bestStreak > (known.bestStreak || 0) ? ev.bestStreak : undefined,
        });
        break;
      case 'history':
        cloud.setHistory(ev.id, ev.history);
        break;
      case 'reset':
        cloud.setProgress(ev.id, progressOf({}));
        break;
    }
  }

  // Signed out (or not signed in yet) only pauses syncing: changes keep waiting in the
  // outbox and are sent after the next sign-in. Only "Turn off" forgets the family account.
  cloud.onAuth((u) => (u ? link(u) : unlink()));

  return {
    status,
    async signIn(email, password) { await cloud.signIn(email.trim(), password); },
    async signUp(email, password) { await cloud.signUp(email.trim(), password); },
    async resetPassword(email) { await cloud.resetPassword(email.trim()); },
    async signOut() {
      store.setSyncInfo(null);
      await cloud.signOut();
    },
  };
}

export function friendlySyncError(err) {
  const code = (err && err.code) || '';
  if (/permission-denied/.test(code)) return "The family account isn't allowed to save. Check the Firestore rules.";
  if (/unavailable|network/.test(code)) return "Can't reach the family account right now. Changes are saved here and will sync later.";
  return (err && err.message) || 'Something went wrong with family sync.';
}

export function friendlyAuthError(err) {
  const code = (err && err.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(code)) return "That email and password don't match a family account.";
  if (/email-already-in-use/.test(code)) return 'There is already a family account with that email. Tap Sign in instead.';
  if (/weak-password/.test(code)) return 'Use a password with at least 6 characters.';
  if (/invalid-email|missing-email/.test(code)) return 'Check the email address.';
  if (/missing-password/.test(code)) return 'Type the password.';
  if (/network-request-failed/.test(code)) return "No internet connection. Try again when you're online.";
  if (/too-many-requests/.test(code)) return 'Too many tries. Wait a few minutes, then try again.';
  if (/operation-not-allowed|admin-restricted/.test(code)) return 'Creating new family accounts is turned off for this app.';
  return (err && err.message) || "Couldn't sign in.";
}
