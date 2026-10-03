// Family sync through Firebase (sign-in + Firestore database).
// The Firebase code (js/vendor/firebase.js) only loads on devices that use family sync.
//
// Data layout, one family per sign-in account:
//   families/{uid}                kids: { [kidId]: { name, color, hintFirst, order, deleted? } }
//   families/{uid}/kids/{kidId}   stars, solved, bestStreak, topics: { [topic]: { tries, firstTry, right } }, history

export async function createFirebaseCloud(config) {
  const f = await import('./vendor/firebase.js');
  const app = f.initializeApp(config);
  const auth = f.initializeAuth(app, { persistence: [f.indexedDBLocalPersistence, f.browserLocalPersistence] });
  let db;
  try {
    // Keeps a copy on the device, so changes made offline are sent when it's back online.
    db = f.initializeFirestore(app, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) });
  } catch {
    db = f.initializeFirestore(app, {});
  }

  let uid = null;
  let pending = 0;
  let pendingListener = () => {};
  const famRef = () => f.doc(db, 'families', uid);
  const kidRef = (id) => f.doc(db, 'families', uid, 'kids', id);
  const kidsCol = () => f.collection(db, 'families', uid, 'kids');

  // Writes return right away (they're saved on the device); we count the ones the server
  // hasn't confirmed yet so the app can show "Saving…" or "Offline".
  function track(promise) {
    pending++;
    pendingListener(pending);
    return promise
      .catch((err) => console.error('sync write failed', err))
      .finally(() => {
        pending--;
        pendingListener(pending);
      });
  }

  // Firestore wants nested objects for merge-updates, with increment() at the leaves.
  function incrementsFor(delta) {
    const out = {};
    if (delta.stars) out.stars = f.increment(delta.stars);
    if (delta.solved) out.solved = f.increment(delta.solved);
    if (delta.bestStreak !== undefined) out.bestStreak = delta.bestStreak;
    if (delta.topics) {
      out.topics = {};
      for (const [k, t] of Object.entries(delta.topics)) {
        out.topics[k] = {};
        for (const field of ['tries', 'firstTry', 'right']) {
          if (t[field]) out.topics[k][field] = f.increment(t[field]);
        }
      }
    }
    return out;
  }

  return {
    signUp: (email, password) => f.createUserWithEmailAndPassword(auth, email, password),
    signIn: (email, password) => f.signInWithEmailAndPassword(auth, email, password),
    resetPassword: (email) => f.sendPasswordResetEmail(auth, email),
    signOut: () => f.signOut(auth),
    onAuth(cb) {
      f.onAuthStateChanged(auth, (u) => {
        uid = u ? u.uid : null;
        cb(u ? { uid: u.uid, email: u.email } : null);
      });
    },
    onPending(cb) { pendingListener = cb; },

    async loadFamily() {
      const fam = await f.getDoc(famRef());
      const kids = (fam.exists() && fam.data().kids) || {};
      const progress = {};
      const snap = await f.getDocs(kidsCol());
      snap.forEach((d) => { progress[d.id] = d.data(); });
      return { kids, progress };
    },

    watch(onKids, onProgress, onError) {
      const a = f.onSnapshot(famRef(), (s) => onKids((s.exists() && s.data().kids) || {}), onError);
      const b = f.onSnapshot(kidsCol(), (qs) => {
        qs.docChanges().forEach((ch) => { if (ch.type !== 'removed') onProgress(ch.doc.id, ch.doc.data()); });
      }, onError);
      return () => { a(); b(); };
    },

    putKid(id, meta, isNew) {
      const m = { name: meta.name, color: meta.color ?? 0, hintFirst: meta.hintFirst !== false };
      if (isNew) m.order = Date.now();
      return track(f.setDoc(famRef(), { kids: { [id]: m } }, { merge: true }));
    },
    deleteKid(id) {
      const batch = f.writeBatch(db);
      batch.set(famRef(), { kids: { [id]: { deleted: true } } }, { merge: true });
      batch.delete(kidRef(id));
      return track(batch.commit());
    },
    setProgress(id, d) {
      return track(f.setDoc(kidRef(id), {
        stars: d.stars || 0,
        solved: d.solved || 0,
        bestStreak: d.bestStreak || 0,
        topics: d.topics || {},
        history: d.history || [],
      }));
    },
    addProgress(id, delta) {
      return track(f.setDoc(kidRef(id), incrementsFor(delta), { merge: true }));
    },
    setHistory(id, history) {
      return track(f.setDoc(kidRef(id), { history }, { merge: true }));
    },
  };
}
