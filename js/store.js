// Progress lives on this device only (localStorage). Nothing is sent anywhere.
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
    const p = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: n, color, data: root.pending || fresh() };
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
};
