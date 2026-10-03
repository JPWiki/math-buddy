// Progress lives on this device (localStorage), so the app works offline. When family sync
// is on, every change is also reported to the sync engine (js/sync.js), and changes from
// other devices come back in through applyCloud*().
// Each kid gets a profile with their own stars, streaks, topic stats, history and settings.

const KEY = 'math-buddy.v2';
const OLD_KEY = 'math-buddy.v1';
export const COLORS = 6;
export const MAX_NAME = 20;

const fresh = () => ({
  stars: 0,
  streak: 0,
  bestStreak: 0,
  solved: 0,
  topics: {},
  history: [],
  settings: { hintFirst: true },
});

const withDefaults = (d) => ({ ...fresh(), ...d, settings: { ...fresh().settings, ...((d && d.settings) || {}) } });
const cleanName = (name) => String(name).trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function browserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// `storage` is anything with getItem/setItem/removeItem; tests pass a fake one.
export function createStore(storage = browserStorage()) {
  let root = load();
  let scratch = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = storage && storage.getItem(KEY);
      if (raw) {
        const r = JSON.parse(raw);
        r.profiles = (r.profiles || []).map((p) => ({ ...p, data: withDefaults(p.data) }));
        if (!r.profiles.some((p) => p.id === r.current)) r.current = r.profiles[0] ? r.profiles[0].id : null;
        return r;
      }
      // Progress saved before profiles existed goes to the first profile that's created.
      const old = storage && storage.getItem(OLD_KEY);
      if (old) return { profiles: [], current: null, pending: withDefaults(JSON.parse(old)) };
    } catch { /* storage blocked: keep everything in memory for this visit */ }
    return { profiles: [], current: null };
  }

  function save() {
    try {
      if (!storage) return;
      storage.setItem(KEY, JSON.stringify(root));
      if (!root.pending) storage.removeItem(OLD_KEY);
    } catch { /* ignore */ }
  }

  // Tell the sync engine (and anyone else listening) what just changed on this device.
  // With family sync on, changes also wait in an outbox (saved with the progress) until
  // they reach the family account, so nothing is lost while the app is still connecting
  // or the device is offline.
  function emit(event) {
    if (root.sync) {
      (root.outbox ||= []).push(event);
      if (root.outbox.length > 2000) root.outbox.splice(0, root.outbox.length - 2000);
      save();
    }
    for (const fn of listeners) {
      try { fn(event); } catch (e) { console.error(e); }
    }
  }

  const current = () => root.profiles.find((p) => p.id === root.current) || null;
  // Before the first profile exists, the app still runs on throwaway in-memory progress.
  const data = () => (current() ? current().data : (scratch ||= fresh()));
  const byId = (id) => root.profiles.find((p) => p.id === id) || null;
  const findByName = (name) => root.profiles.find((p) => p.name.toLowerCase() === String(name).toLowerCase()) || null;
  const meta = (p) => ({ name: p.name, color: p.color, hintFirst: p.data.settings.hintFirst !== false });
  const freeColor = (wanted) => {
    const used = new Set(root.profiles.map((x) => x.color));
    if (wanted !== undefined && !used.has(wanted)) return wanted;
    for (let c = 0; c < COLORS; c++) if (!used.has(c)) return c;
    return wanted ?? 0;
  };

  const store = {
    get: () => data(),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // ---- profiles ----
    profiles: () => root.profiles.map(({ id, name, color, data: d }) => ({ id, name, color, stars: d.stars })),
    current: () => {
      const p = current();
      return p ? { id: p.id, name: p.name, color: p.color } : null;
    },
    hasOldProgress: () => !!root.pending,
    addProfile(name) {
      const n = cleanName(name);
      if (!n) throw new Error('Type a name first.');
      const dup = findByName(n);
      if (dup) throw new Error(`There's already a profile called ${dup.name}.`);
      const p = { id: newId(), name: n, color: freeColor(), data: root.pending || fresh() };
      delete root.pending;
      root.profiles.push(p);
      root.current = p.id;
      save();
      emit({ type: 'kid', id: p.id, meta: meta(p), data: p.data });
      return p.id;
    },
    switchTo(id) {
      if (!byId(id)) return;
      root.current = id;
      save();
    },
    renameProfile(id, name) {
      const n = cleanName(name);
      if (!n) throw new Error('Type a name first.');
      const dup = root.profiles.find((p) => p.id !== id && p.name.toLowerCase() === n.toLowerCase());
      if (dup) throw new Error(`There's already a profile called ${dup.name}.`);
      const p = byId(id);
      if (p) {
        p.name = n;
        save();
        emit({ type: 'kid', id, meta: meta(p) });
      }
    },
    deleteProfile(id) {
      root.profiles = root.profiles.filter((p) => p.id !== id);
      if (root.current === id) root.current = root.profiles[0] ? root.profiles[0].id : null;
      save();
      emit({ type: 'delete', id });
    },

    // ---- the current kid's progress ----
    setting(name, value) {
      if (value === undefined) return data().settings[name];
      data().settings[name] = value;
      save();
      const p = current();
      if (p) emit({ type: 'kid', id: p.id, meta: meta(p) });
    },
    addStars(n) {
      data().stars += n;
      save();
      if (current()) emit({ type: 'stars', id: root.current, n });
    },
    addHistory(text) {
      const d = data();
      d.history = [text, ...d.history.filter((h) => h !== text)].slice(0, 15);
      save();
      if (current()) emit({ type: 'history', id: root.current, history: d.history });
    },
    // firstTry: right on the first attempt. right: right on any attempt.
    recordPractice(topic, { firstTry, right }) {
      const d = data();
      const t = d.topics[topic] || { tries: 0, firstTry: 0, right: 0 };
      t.tries++;
      if (firstTry) t.firstTry++;
      if (right) t.right++;
      d.topics[topic] = t;
      if (right) d.solved++;
      d.streak = firstTry ? d.streak + 1 : right ? d.streak : 0;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
      save();
      if (current()) emit({ type: 'practice', id: root.current, topic, firstTry, right, bestStreak: d.bestStreak });
      return d.streak;
    },
    reset() {
      const p = current();
      if (!p) return;
      p.data = { ...fresh(), settings: p.data.settings };
      save();
      emit({ type: 'reset', id: p.id });
    },

    // ---- moving progress between devices (files) ----
    // A backup holds every kid on this device, so one file moves the whole family.
    exportBackup(appVersion) {
      return {
        app: BACKUP_APP,
        format: BACKUP_FORMAT,
        appVersion,
        savedAt: new Date().toISOString(),
        profiles: root.profiles.map(({ name, color, data: d }) => ({ name, color, data: d })),
      };
    },
    // What loading a backup would do: which kids are new and whose progress gets replaced.
    previewBackup(backup) {
      return backup.profiles.map((p) => {
        const here = findByName(p.name);
        return { name: p.name, stars: p.data.stars, replaces: here ? { name: here.name, stars: here.data.stars } : null };
      });
    },
    // Kids in the file replace the same-named kid here (or are added). Other kids here stay.
    loadBackup(backup) {
      let added = 0, replaced = 0;
      for (const p of backup.profiles) {
        const here = findByName(p.name);
        if (here) {
          here.data = withDefaults(p.data);
          replaced++;
          emit({ type: 'replace', id: here.id, meta: meta(here), data: here.data });
        } else {
          const np = { id: newId(), name: p.name, color: freeColor(p.color), data: withDefaults(p.data) };
          root.profiles.push(np);
          added++;
          emit({ type: 'kid', id: np.id, meta: meta(np), data: np.data });
        }
      }
      delete root.pending;
      if (!current() && root.profiles[0]) root.current = root.profiles[0].id;
      save();
      return { added, replaced };
    },

    // ---- family sync ----
    syncInfo: () => root.sync || null,
    setSyncInfo(info) {
      if (info) root.sync = info;
      else { delete root.sync; delete root.outbox; }
      save();
    },
    // Changes not yet sent to the family account, oldest first. Taking them empties the outbox.
    takeOutbox() {
      const out = root.outbox || [];
      if (out.length) { root.outbox = []; save(); }
      return out;
    },
    // Full local copies of every kid, for the first upload to the family account.
    snapshotKids: () => root.profiles.map((p) => ({ id: p.id, meta: meta(p), data: p.data })),
    // Swap this device's kids for the family's kids (used when a device joins).
    adoptKids(kids) {
      const currentName = current() && current().name;
      root.profiles = kids.map((k) => ({
        id: k.id,
        name: k.meta.name,
        color: k.meta.color ?? 0,
        data: withDefaults({ ...k.data, settings: { hintFirst: k.meta.hintFirst !== false } }),
      }));
      const again = currentName && findByName(currentName);
      root.current = again ? again.id : root.profiles[0] ? root.profiles[0].id : null;
      delete root.pending;
      save();
    },
    // Kid list from the family account: names, colors, settings, and who was deleted.
    applyCloudKids(kidsMeta) {
      const live = Object.entries(kidsMeta || {}).filter(([, m]) => m && !m.deleted && m.name);
      const ids = new Set(live.map(([id]) => id));
      root.profiles = root.profiles.filter((p) => ids.has(p.id));
      for (const [id, m] of live.sort((a, b) => (a[1].order || 0) - (b[1].order || 0))) {
        const p = byId(id);
        if (p) {
          p.name = m.name;
          p.color = m.color ?? p.color;
          p.data.settings.hintFirst = m.hintFirst !== false;
        } else {
          root.profiles.push({ id, name: m.name, color: m.color ?? 0, data: withDefaults({ settings: { hintFirst: m.hintFirst !== false } }) });
        }
      }
      if (!current()) root.current = root.profiles[0] ? root.profiles[0].id : null;
      save();
    },
    // One kid's numbers from the family account. The streak in progress stays per device.
    applyCloudProgress(id, d) {
      const p = byId(id);
      if (!p || !d) return;
      const topics = {};
      for (const [k, t] of Object.entries(d.topics || {})) {
        topics[k] = { tries: t.tries || 0, firstTry: t.firstTry || 0, right: t.right || 0 };
      }
      p.data = {
        ...p.data,
        stars: d.stars || 0,
        solved: d.solved || 0,
        bestStreak: Math.max(d.bestStreak || 0, p.data.streak || 0),
        topics,
        history: Array.isArray(d.history) ? d.history.slice(0, 15) : p.data.history,
      };
      save();
    },
  };
  return store;
}

const BACKUP_APP = 'math-buddy';
const BACKUP_FORMAT = 1;

const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

// Checks a backup file and keeps only what the app understands, so a damaged or
// hand-edited file can't break the app.
export function readBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Math Buddy progress file.");
  }
  if (!raw || raw.app !== BACKUP_APP || !Array.isArray(raw.profiles)) throw new Error("That file isn't a Math Buddy progress file.");
  if (Number(raw.format) > BACKUP_FORMAT) throw new Error('That file was saved by a newer version of Math Buddy. Update the app, then try again.');
  const seen = new Set();
  const profiles = [];
  for (const p of raw.profiles.slice(0, 20)) {
    const name = cleanName((p && p.name) || '');
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const d = (p && p.data) || {};
    const topics = {};
    for (const [k, t] of Object.entries(d.topics || {})) {
      if (/^[a-z]{1,20}$/.test(k) && t) topics[k] = { tries: count(t.tries), firstTry: count(t.firstTry), right: count(t.right) };
    }
    profiles.push({
      name,
      color: Math.min(COLORS - 1, count(p.color)),
      data: withDefaults({
        stars: count(d.stars),
        streak: count(d.streak),
        bestStreak: count(d.bestStreak),
        solved: count(d.solved),
        topics,
        history: (Array.isArray(d.history) ? d.history : []).filter((h) => typeof h === 'string').map((h) => h.slice(0, 400)).slice(0, 15),
        settings: { hintFirst: !d.settings || d.settings.hintFirst !== false },
      }),
    });
  }
  if (!profiles.length) throw new Error("That file doesn't have any kids' progress in it.");
  return { savedAt: raw.savedAt ? new Date(raw.savedAt) : null, appVersion: raw.appVersion || '', profiles };
}

export const store = createStore();
