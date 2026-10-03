// Progress lives on this device only (localStorage). Nothing is sent anywhere.

const KEY = 'math-buddy.v1';

const fresh = () => ({
  stars: 0,
  streak: 0,
  bestStreak: 0,
  solved: 0,
  topics: {},
  history: [],
  settings: { hintFirst: true },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...fresh(), ...s, settings: { ...fresh().settings, ...(s.settings || {}) } };
    }
  } catch { /* storage blocked: keep progress in memory for this visit */ }
  return fresh();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export const store = {
  get: () => state,
  setting(name, value) {
    if (value === undefined) return state.settings[name];
    state.settings[name] = value;
    save();
  },
  addStars(n) { state.stars += n; save(); },
  addHistory(text) {
    state.history = [text, ...state.history.filter((h) => h !== text)].slice(0, 15);
    save();
  },
  // firstTry: right on the first attempt. right: right on any attempt.
  recordPractice(topic, { firstTry, right }) {
    const t = state.topics[topic] || { tries: 0, firstTry: 0, right: 0 };
    t.tries++;
    if (firstTry) t.firstTry++;
    if (right) t.right++;
    state.topics[topic] = t;
    if (right) state.solved++;
    state.streak = firstTry ? state.streak + 1 : right ? state.streak : 0;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    save();
    return state.streak;
  },
  reset() {
    const settings = state.settings;
    state = { ...fresh(), settings };
    save();
  },
};
