// Progress lives on this device (localStorage). Nothing is sent anywhere; grown-ups can
// save it to a file and load it on another device.
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

let root = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const r = JSON.parse(raw);
      r.profiles = (r.profiles || []).map((p) => ({ ...p, data: withDefaults(p.data) }));
      if (!r.profiles.some((p) => p.id === r.current)) r.current = r.profiles[0] ? r.profiles[0].id : null;
      return r;
    }
    // Progress saved before profiles existed goes to the first profile that's created.
    const old = localStorage.getItem(OLD_KEY);
    if (old) return { profiles: [], current: null, pending: withDefaults(JSON.parse(old)) };
  } catch { /* storage blocked: keep everything in memory for this visit */ }
  return { profiles: [], current: null };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(root));
    if (!root.pending) localStorage.removeItem(OLD_KEY);
  } catch { /* ignore */ }
}

const current = () => root.profiles.find((p) => p.id === root.current) || null;
// Before the first profile exists, the app still runs on throwaway in-memory progress.
let scratch = null;
const data = () => (current() ? current().data : (scratch ||= fresh()));
const cleanName = (name) => String(name).trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);

export const store = {
  get: () => data(),

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
    const dup = root.profiles.find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (dup) throw new Error(`There's already a profile called ${dup.name}.`);
    const used = new Set(root.profiles.map((p) => p.color));
    let color = 0;
    while (used.has(color) && color < COLORS - 1) color++;
    const p = { id: newId(), name: n, color, data: root.pending || fresh() };
    delete root.pending;
    root.profiles.push(p);
    root.current = p.id;
    save();
    return p.id;
  },
  switchTo(id) {
    if (!root.profiles.some((p) => p.id === id)) return;
    root.current = id;
    save();
  },
  renameProfile(id, name) {
    const n = cleanName(name);
    if (!n) throw new Error('Type a name first.');
    const dup = root.profiles.find((p) => p.id !== id && p.name.toLowerCase() === n.toLowerCase());
    if (dup) throw new Error(`There's already a profile called ${dup.name}.`);
    const p = root.profiles.find((x) => x.id === id);
    if (p) { p.name = n; save(); }
  },
  deleteProfile(id) {
    root.profiles = root.profiles.filter((p) => p.id !== id);
    if (root.current === id) root.current = root.profiles[0] ? root.profiles[0].id : null;
    save();
  },

  // ---- the current kid's progress ----
  setting(name, value) {
    if (value === undefined) return data().settings[name];
    data().settings[name] = value;
    save();
  },
  addStars(n) { data().stars += n; save(); },
  addHistory(text) {
    const d = data();
    d.history = [text, ...d.history.filter((h) => h !== text)].slice(0, 15);
    save();
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
    return d.streak;
  },
  reset() {
    const p = current();
    if (!p) return;
    p.data = { ...fresh(), settings: p.data.settings };
    save();
  },

  // ---- moving progress between devices ----
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
      } else {
        const used = new Set(root.profiles.map((x) => x.color));
        const color = used.has(p.color) ? [...Array(COLORS).keys()].find((c) => !used.has(c)) ?? p.color : p.color;
        root.profiles.push({ id: newId(), name: p.name, color, data: withDefaults(p.data) });
        added++;
      }
    }
    delete root.pending;
    if (!current() && root.profiles[0]) root.current = root.profiles[0].id;
    save();
    return { added, replaced };
  },
};

const BACKUP_APP = 'math-buddy';
const BACKUP_FORMAT = 1;

function newId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function findByName(name) {
  return root.profiles.find((p) => p.name.toLowerCase() === String(name).toLowerCase()) || null;
}

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
