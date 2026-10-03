// Practice problem makers. Each returns the problem as text; the solver works out the answer,
// so the "See how" steps and the answer always agree.
//
// Difficulty follows the CBSE (NCERT) syllabus for Classes 1-8: for each class, Medium is
// what CBSE expects in that class, Easy is a step below and Hard a step above. Every kid
// in the same class gets the same levels.

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// A fraction less than 1 that's already in simplest form.
function properFrac(dens) {
  const d = pick(dens);
  let n = rnd(1, d - 1);
  while (gcd(n, d) !== 1) n = rnd(1, d - 1);
  return [n, d];
}

// A decimal that doesn't end in 0, so 4.0 never shows up.
function dec(lo, hi, places) {
  let v = rnd(lo, hi);
  while (v % 10 === 0) v = rnd(lo, hi);
  return (v / 10 ** places).toFixed(places);
}

export const LEVELS = ['Easy', 'Medium', 'Hard'];
// Stars for each problem right on the first try, by level.
export const LEVEL_STARS = [1, 2, 3];

// CBSE classes 1 to 8, with the usual ages, so grown-ups can pick either.
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
export const gradeLabel = (g) => `Class ${g}`;
export const gradeAges = (g) => `age ${g + 5}–${g + 6}`;

const T = '×';
const D = '÷';
const M = '−';
const digits = (n) => rnd(10 ** (n - 1), 10 ** n - 1);
const minus = (x, y) => `${Math.max(x, y)} ${M} ${Math.min(x, y)}`;
const nz = (lo, hi) => { let v = 0; while (!v) v = rnd(lo, hi); return v; };
const sgn = (v) => (v < 0 ? `(${M}${-v})` : `${v}`);
const lead = (v) => (v < 0 ? `${M}${-v}` : `${v}`);
// Two numbers whose ones digits add to 10 or more, so the sum needs carrying.
function carryPair(n1, n2) {
  let a, b;
  do { a = digits(n1); b = digits(n2); } while ((a % 10) + (b % 10) < 10);
  return [a, b];
}
// Two numbers where taking away needs borrowing in the ones.
function borrowPair(n1, n2) {
  let a, b;
  do { a = digits(n1); b = digits(n2); } while (a <= b || (a % 10) >= (b % 10));
  return [a, b];
}
// A multiplication fact, mostly the tricky ones rather than x10 and x11.
function trickyFact(lo, hi) {
  let a = rnd(lo, hi), b = rnd(lo, hi);
  while ((a === 10 || a === 11 || b === 10 || b === 11) && Math.random() < 0.8) { a = rnd(lo, hi); b = rnd(lo, hi); }
  return `${a} ${T} ${b}`;
}

// Each topic has a ladder of `steps` (easiest first), and `classes` says which steps each
// CBSE class gets for [Easy, Medium, Hard].
export const TOPICS = [
  {
    id: 'add', name: 'Addition', sample: '347 + 285',
    steps: [
      () => { const a = rnd(1, 8); return `${a} + ${rnd(1, 10 - a)}`; }, // within 10
      () => { const a = rnd(3, 9); return `${a} + ${rnd(11 - a, 9)}`; }, // within 20, crossing 10
      () => `${rnd(11, 89)} + ${rnd(2, 9)}`,
      () => carryPair(2, 2).join(' + '),
      () => `${digits(3)} + ${digits(2)}`,
      () => carryPair(3, 3).join(' + '),
      () => carryPair(4, 4).join(' + '),
      () => `${digits(5)} + ${digits(4)}`,
    ],
    classes: { 1: [0, 1, 2], 2: [2, 3, 4], 3: [4, 5, 6], 4: [5, 6, 7] },
  },
  {
    id: 'sub', name: 'Subtraction', sample: '503 − 278',
    steps: [
      () => { const a = rnd(3, 10); return `${a} ${M} ${rnd(1, a - 1)}`; },
      () => { const a = rnd(11, 19); return `${a} ${M} ${rnd(a - 9, 9)}`; },
      () => `${rnd(21, 99)} ${M} ${rnd(2, 9)}`,
      () => borrowPair(2, 2).join(` ${M} `),
      () => `${digits(3)} ${M} ${digits(2)}`,
      () => borrowPair(3, 3).join(` ${M} `),
      () => borrowPair(4, 4).join(` ${M} `),
      () => minus(digits(5), digits(4)),
    ],
    classes: { 1: [0, 1, 2], 2: [2, 3, 4], 3: [4, 5, 6], 4: [5, 6, 7] },
  },
  {
    id: 'times', name: 'Times tables', sample: '7 × 8',
    steps: [
      () => `${pick([2, 5, 10])} ${T} ${rnd(1, 10)}`,
      () => `${pick([2, 3, 4, 5, 10])} ${T} ${rnd(2, 10)}`,
      () => trickyFact(3, 10),
      () => trickyFact(3, 12),
      () => `${rnd(13, 99)} ${T} ${rnd(3, 9)}`,
      () => `${rnd(102, 999)} ${T} ${rnd(3, 9)}`,
    ],
    classes: { 2: [0, 1, 2], 3: [1, 2, 3], 4: [3, 4, 5] },
  },
  {
    id: 'div', name: 'Division', sample: '84 ÷ 7',
    steps: [
      () => { const b = pick([2, 5, 10]); return `${b * rnd(1, 10)} ${D} ${b}`; },
      () => { const b = rnd(2, 10); return `${b * rnd(2, 10)} ${D} ${b}`; },
      () => { const b = rnd(2, 9); return `${b * rnd(11, 30)} ${D} ${b}`; },
      () => { const b = rnd(3, 9); return `${b * rnd(21, 199)} ${D} ${b}`; },
      () => { const b = rnd(3, 9); return `${b * rnd(201, 1999)} ${D} ${b}`; },
      () => { const b = rnd(11, 30); return `${b * rnd(12, 60)} ${D} ${b}`; },
      () => { const b = rnd(12, 99); return `${b * rnd(101, 999)} ${D} ${b}`; },
    ],
    classes: { 3: [0, 1, 2], 4: [2, 3, 4], 5: [4, 5, 6] },
  },
  {
    id: 'longmul', name: 'Big multiplying', sample: '236 × 45',
    steps: [
      () => `${rnd(13, 99)} ${T} ${rnd(3, 9)}`,
      () => `${rnd(102, 999)} ${T} ${rnd(3, 9)}`,
      () => `${rnd(13, 99)} ${T} ${rnd(13, 99)}`,
      () => `${rnd(102, 999)} ${T} ${rnd(13, 99)}`,
      () => `${rnd(102, 999)} ${T} ${rnd(102, 999)}`,
    ],
    classes: { 4: [1, 2, 3], 5: [2, 3, 4] },
  },
  {
    id: 'fracadd', name: 'Adding fractions', sample: '3/4 + 1/6',
    steps: [
      () => { const d = rnd(3, 8); const a = rnd(1, d - 2); return `${a}/${d} + ${rnd(1, d - a - 1)}/${d}`; },
      () => {
        const d = rnd(5, 12); const a = rnd(1, d - 1), b = rnd(1, d - 1);
        return Math.random() < 0.5 || a === b ? `${a}/${d} + ${b}/${d}` : `${Math.max(a, b)}/${d} ${M} ${Math.min(a, b)}/${d}`;
      },
      () => { const [b, d] = pick([[2, 4], [2, 6], [3, 6], [4, 8], [2, 8], [3, 9], [5, 10]]); return `${properFrac([b])[0]}/${b} + ${properFrac([d])[0]}/${d}`; },
      () => {
        const dens = [2, 3, 4, 5, 6, 8, 9, 10, 12];
        let [a, b] = properFrac(dens), [c, d] = properFrac(dens);
        while (b === d) [c, d] = properFrac(dens);
        return Math.random() < 0.5 ? `${a}/${b} + ${c}/${d}` : (a / b >= c / d ? `${a}/${b} ${M} ${c}/${d}` : `${c}/${d} ${M} ${a}/${b}`);
      },
      () => { const [a, b] = properFrac([2, 3, 4, 5, 6]), [c, d] = properFrac([2, 3, 4, 6, 8]); return `${rnd(1, 4)} ${a}/${b} + ${rnd(1, 3)} ${c}/${d}`; },
      () => {
        const [a, b] = properFrac([3, 4, 5, 6, 8]); let [c, d] = properFrac([2, 3, 4, 6, 9]);
        while (c / d <= a / b || d === b) [c, d] = properFrac([2, 3, 4, 6, 9]);
        const w = rnd(3, 6);
        return `${w} ${a}/${b} ${M} ${rnd(1, w - 1)} ${c}/${d}`; // needs borrowing a whole
      },
    ],
    classes: { 4: [0, 1, 2], 5: [2, 3, 4], 6: [3, 4, 5] },
  },
  {
    id: 'fracmul', name: 'Multiplying fractions', sample: '12 × 3/4',
    steps: [
      () => { const b = rnd(2, 6); return `1/${b} of ${b * rnd(2, 9)}`; },
      () => { const [a, b] = properFrac([2, 3, 4, 5, 6, 8, 10]); return `${b * rnd(2, 6)} ${T} ${a}/${b}`; },
      () => { const [a, b] = properFrac([2, 3, 4, 5, 6, 8]); const [c, d] = properFrac([2, 3, 4, 5, 6, 9]); return `${a}/${b} ${T} ${c}/${d}`; },
      () => { const [a, b] = properFrac([2, 3, 4, 5, 6, 8]); return pick([`${a}/${b} ${D} ${rnd(2, 6)}`, `${rnd(2, 6)} ${D} ${a}/${b}`]); },
      () => { const [a, b] = properFrac([2, 3, 4, 5, 6, 8, 10]); const [c, d] = properFrac([2, 3, 4, 5, 6, 9]); return `${a}/${b} ${D} ${c}/${d}`; },
      () => { const [a, b] = properFrac([2, 3, 4, 5]); const [c, d] = properFrac([2, 3, 4, 6]); return pick([`${rnd(1, 3)} ${a}/${b} ${T} ${rnd(1, 3)} ${c}/${d}`, `${rnd(1, 4)} ${a}/${b} ${D} ${c}/${d}`]); },
      () => { const [a, b] = properFrac([2, 3, 4, 5]); const [c, d] = properFrac([2, 3, 4, 6]); const [e, f] = properFrac([2, 3, 5]); return `${a}/${b} ${T} ${c}/${d} ${D} ${e}/${f}`; },
    ],
    classes: { 5: [0, 1, 2], 6: [1, 2, 3], 7: [3, 4, 5], 8: [4, 5, 6] },
  },
  {
    id: 'dec', name: 'Decimals', sample: '3.5 + 12.25',
    steps: [
      () => `${dec(11, 49, 1)} + ${dec(11, 49, 1)}`,
      () => { const a = Number(dec(11, 99, 1)), b = Number(dec(11, 99, 1)); return Math.random() < 0.5 ? `${a} + ${b}` : `${Math.max(a, b)} ${M} ${Math.min(a, b)}`; },
      () => { const a = Number(dec(101, 999, 2)), b = Number(dec(11, 99, 1)); return Math.random() < 0.5 ? `${a} + ${b}` : `${Math.max(a, b)} ${M} ${Math.min(a, b)}`; },
      () => pick([`${dec(101, 999, 2)} ${T} ${pick([10, 100, 1000])}`, `${dec(11, 999, 1)} ${D} ${pick([10, 100])}`]),
      () => `${dec(11, 99, 1)} ${T} ${rnd(2, 9)}`,
      () => { const dv = rnd(3, 9); let k = rnd(11, 99); while ((k * dv) % 10 === 0) k = rnd(11, 99); return `${((k * dv) / 10).toFixed(1)} ${D} ${dv}`; },
      () => `${dec(11, 49, 1)} ${T} ${dec(11, 29, 1)}`,
      () => { const dv = rnd(2, 5); return pick([`${(rnd(3, 30) * dv) / 10} ${D} 0.${dv}`, `${Number(((rnd(11, 60) * 5) / 100).toFixed(2))} ${D} 0.05`]); },
    ],
    classes: { 4: [0, 1, 2], 5: [1, 2, 3], 6: [2, 3, 4], 7: [4, 5, 6], 8: [5, 6, 7] },
  },
  {
    id: 'order', name: 'Simplification (BODMAS)', sample: '2 + 3 × (8 − 2)',
    steps: [
      () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9); return pick([`${a} + ${b} ${T} ${c}`, `${a * b + c} ${M} ${a} ${T} ${b}`, `${a} ${T} ${b} + ${c}`]); },
      () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9); return pick([`(${a} + ${b}) ${T} ${c}`, `${a} ${T} (${b + c} ${M} ${c})`, `${c * a} ${D} ${c} + ${b}`]); },
      () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(1, 9); return pick([`${a} + ${b} ${T} ${c} ${M} ${d}`, `${c * (a + b)} ${D} (${a} + ${b}) + ${d}`, `${a * c} ${D} ${c} + ${b} ${T} ${d}`]); },
      () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(1, 9); return pick([`(${a} + ${b}) ${T} ${c} ${M} ${d}`, `${a} ${T} [${b} + (${c + d} ${M} ${d})]`, `${(a + b) * c} ${D} (${a} + ${b}) ${T} ${d}`]); },
      () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(1, 5); return pick([`${a}^2 + ${b} ${T} ${c}`, `(${a} + ${b}) ${T} ${c} ${M} ${d}^2`, `${rnd(2, 5)}^3 ${M} ${a} ${T} ${b}`]); },
      () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(1, 9); return pick([`${M}${a} ${T} ${b} + ${c}^2`, `(${d} ${M} ${a + d}) ${T} ${b} + ${c}`, `(${M}${a})^2 ${M} ${b} ${T} ${c}`]); },
      () => { const a = rnd(2, 6), b = rnd(2, 9), c = rnd(2, 5), d = rnd(2, 9); return pick([`(${a} ${M} ${a + b})^2 ${D} ${b} + (${M}${c}) ${T} ${d}`, `${c}^3 ${M} [${d} ${M} (${M}${a})] ${T} ${b}`]); },
    ],
    classes: { 5: [0, 1, 2], 6: [1, 2, 3], 7: [3, 4, 5], 8: [4, 5, 6] },
  },
  {
    id: 'neg', name: 'Integers', sample: '−5 + 8',
    steps: [
      () => `${lead(-rnd(1, 9))} + ${rnd(1, 15)}`,
      () => pick([`${rnd(1, 9)} ${M} ${rnd(10, 20)}`, `${lead(-rnd(1, 15))} ${M} ${rnd(1, 15)}`, `${rnd(1, 15)} ${M} ${sgn(-rnd(1, 15))}`, `${lead(-rnd(1, 15))} + ${sgn(-rnd(1, 15))}`]),
      () => { const x = -rnd(2, 12), y = nz(-12, 12); return pick([`${lead(y)} ${T} ${sgn(x)}`, `${lead(x * y)} ${D} ${sgn(y)}`, `${lead(x * y)} ${D} ${sgn(x)}`]); },
      () => { const x = -rnd(1, 12), y = nz(-12, 12); return pick([`${lead(x)} + ${sgn(y)} ${T} ${rnd(2, 5)}`, `(${lead(x)} ${M} ${sgn(y)}) ${T} ${sgn(nz(-5, 5))}`, `${lead(x * 3)} ${D} 3 ${M} ${sgn(y)}`]); },
      () => { const x = -rnd(2, 9), y = nz(-9, 9); return pick([`${lead(nz(-30, 30))} ${M} ${sgn(nz(-30, 30))} ${T} ${sgn(nz(-9, 9))}`, `${sgn(x)}^2 ${M} ${rnd(2, 4)}^3`, `(${lead(x)} + ${sgn(y)}) ${T} (${lead(y)} ${M} ${sgn(x)})`]); },
      () => { const x = -rnd(2, 6), y = rnd(2, 6), z = nz(-9, 9); return pick([`${sgn(x)}^3 ${D} ${sgn(x)} + ${sgn(z)} ${T} ${y}`, `[${lead(z)} ${M} (${lead(x)} ${T} ${y})] ${D} ${sgn(-1)}`]); },
    ],
    classes: { 6: [0, 1, 2], 7: [2, 3, 4], 8: [3, 4, 5] },
  },
  {
    id: 'pct', name: 'Percentages', sample: '25% of 80',
    steps: [
      () => `${pick([50, 100])}% of ${rnd(1, 15) * 20}`,
      () => `${pick([10, 25, 50])}% of ${rnd(1, 15) * 20}`,
      () => `${pick([20, 75, 5, 30, 40])}% of ${rnd(1, 15) * 20}`,
      () => `${rnd(1, 19) * 5}% of ${rnd(1, 15) * 20}`,
      () => `${rnd(1, 99)}% of ${rnd(1, 9) * 100}`,
      () => `${pick([12.5, 2.5, 7.5, 150, 120, 33])}% of ${rnd(1, 12) * 40}`,
    ],
    classes: { 7: [2, 3, 4], 8: [3, 4, 5] },
  },
  {
    id: 'eq', name: 'Equations', sample: '3x + 5 = 20',
    steps: [
      () => { const x = rnd(2, 12), k = rnd(2, 20); return pick([`? + ${k} = ${x + k}`, `${x + k} ${M} ? = ${k}`]); },
      () => { const x = rnd(2, 12), a = rnd(2, 9); return pick([`? ${T} ${a} = ${x * a}`, `? ${D} ${a} = ${x}`]); },
      () => { const x = rnd(2, 10), a = rnd(2, 9), b = rnd(1, 15); return `? ${T} ${a} + ${b} = ${x * a + b}`; },
      () => { const a = rnd(2, 15), x = rnd(a + 1, a + 20); return pick([`x + ${a} = ${x + a}`, `x ${M} ${a} = ${x - a}`, `${a}x = ${a * x}`]); },
      () => { const x = rnd(2, 12), a = rnd(2, 9), b = rnd(1, 20); return Math.random() < 0.5 ? `${a}x + ${b} = ${a * x + b}` : `${a}x ${M} ${Math.min(b, a * x - 1)} = ${a * x - Math.min(b, a * x - 1)}`; },
      () => { const x = rnd(2, 12), a = rnd(2, 9), b = rnd(1, 20), k = rnd(2, 9); return pick([`${a}(x + ${b}) = ${a * (x + b)}`, `x/${a} + ${b} = ${k + b}`]); },
      () => { const x = rnd(2, 12), a = rnd(3, 9), b = rnd(1, 20), c = rnd(1, a - 1), d = rnd(1, x - 1); return pick([`${a}x + ${b} = ${c === 1 ? '' : c}x + ${a * x + b - c * x}`, `${a}(x ${M} ${d}) = ${a * (x - d)}`]); },
      () => { const x = rnd(2, 12), a = rnd(3, 6), b = rnd(1, 9), c = rnd(1, a - 1); return `${a}(x + ${b}) = ${c === 1 ? '' : c}x + ${a * (x + b) - c * x}`; },
    ],
    classes: { 3: [0, 1, 2], 4: [1, 2, 3], 5: [1, 2, 3], 6: [2, 3, 4], 7: [3, 4, 5], 8: [5, 6, 7] },
  },
  {
    id: 'words', name: 'Word problems', sample: '6 friends share 24…',
    // [kind of problem, number size]: percentages and fractions of amounts only from Class 7.
    steps: [[0, 'tiny'], [0, 'small'], [0, 'normal'], [1, 'normal'], [2, 'normal'], [1, 'big'], [2, 'big'], [3, 'normal'], [3, 'big']].map(([lv, size]) => () => wordProblem(lv, size).text),
    classes: { 1: [0, 1, 2], 2: [1, 2, 3], 3: [2, 3, 4], 4: [3, 4, 5], 5: [3, 4, 6], 6: [4, 5, 6], 7: [5, 7, 8], 8: [6, 7, 8] },
  },
];

const classesOf = (topic) => Object.keys(topic.classes).map(Number);

export const inGrade = (topic, grade) => !grade || classesOf(topic).includes(grade);

// Which step a kid gets for a topic at their class and the level they picked. A class
// outside the topic's range uses the nearest class; no class set uses the middle one.
export function tierFor(topic, grade, level) {
  const cs = classesOf(topic);
  const g = grade
    ? cs.reduce((best, c) => (Math.abs(c - grade) < Math.abs(best - grade) ? c : best), cs[0])
    : cs[Math.floor((cs.length - 1) / 2)];
  return topic.classes[g][level];
}

export const gen = (topic, tier) => topic.steps[tier]();

// Negative answers only where kids have learned integers (Class 6 and up).
export const allowsNegatives = (topic, grade) => topic.id === 'neg' || (grade || 0) >= 6;

// ---------- word problems ----------

const KIDS = [['Aarav', 'he'], ['Ananya', 'she'], ['Kabir', 'he'], ['Diya', 'she'], ['Ishaan', 'he'], ['Meera', 'she'], ['Rohan', 'he'], ['Saanvi', 'she'], ['Arjun', 'he'], ['Priya', 'she'], ['Maya', 'she'], ['Leo', 'he']];
const THINGS = ['stickers', 'marbles', 'cards', 'shells', 'stamps', 'beads', 'crayons', 'laddoos', 'mangoes', 'books'];
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

function twoKids() {
  const a = pick(KIDS);
  let b = pick(KIDS);
  while (b === a) b = pick(KIDS);
  return [a, b];
}

// Returns { text, answer } so tests can check the reader gets the right answer.
// level: 0 = add/take away, 1 = groups/sharing/comparing, 2 = two steps and money,
// 3 = percentages and fractions of amounts.
// size: 'tiny' (within 10), 'small' (within 20), 'normal', 'big'.
export function wordProblem(level, size = 'normal') {
  const [[n, he], [m]] = twoKids();
  const t = pick(THINGS);
  const big = size === 'big';
  if (level === 0) {
    const [a, b] = size === 'tiny' ? [rnd(2, 6), rnd(1, 4)] : size === 'small' ? [rnd(3, 12), rnd(2, 8)] : [rnd(12, 60), rnd(5, 30)];
    return pick([
      () => ({ text: `${n} has ${a} ${t}. ${cap1(he)} gets ${b} more. How many ${t} does ${n} have now?`, answer: a + b }),
      () => ({ text: `${n} had ${a + b} ${t}. ${cap1(he)} gave ${b} to ${m}. How many ${t} are left?`, answer: a }),
      () => ({ text: `There are ${a + b} kids on the bus. At the next stop, ${b} get off. How many kids are still on the bus?`, answer: a }),
      () => ({ text: `${n} read ${a} pages on Monday and ${b} pages on Tuesday. How many pages did ${he} read in all?`, answer: a + b }),
      () => ({ text: `${n} picked ${a} mangoes and ${m} picked ${b} mangoes. How many mangoes did they pick altogether?`, answer: a + b }),
      () => ({ text: `A shop had ${a + b} balloons. It sold ${b}. How many balloons does the shop have left?`, answer: a }),
    ])();
  }
  if (level === 1) {
    const g = big ? rnd(12, 30) : rnd(3, 9), k = big ? rnd(12, 40) : rnd(3, 12);
    const a = big ? rnd(300, 900) : rnd(30, 90), b = big ? rnd(100, a - 50) : rnd(10, a - 5);
    return pick([
      () => ({ text: `Each box holds ${k} ${t}. How many ${t} are in ${g} boxes?`, answer: g * k }),
      () => ({ text: `${n} shares ${g * k} ${t} equally among ${g} friends. How many ${t} does each friend get?`, answer: k }),
      () => ({ text: `${n} has ${a} ${t}. ${m} has ${b} ${t}. How many more ${t} does ${n} have than ${m}?`, answer: a - b }),
      () => ({ text: `There are ${g} rows of chairs with ${k} chairs in each row. How many chairs are there in all?`, answer: g * k }),
      () => ({ text: `There are ${g * k} students split into teams of ${k}. How many teams are there?`, answer: g }),
      () => ({ text: `${n} reads ${k} pages a day for ${g} days. How many pages does ${he} read?`, answer: g * k }),
    ])();
  }
  if (level === 2) {
    const price = big ? rnd(12, 60) : rnd(5, 20), qty = big ? rnd(4, 12) : rnd(2, 6), cash = price * qty + rnd(1, big ? 200 : 50);
    const a = big ? rnd(120, 400) : rnd(20, 50), b = big ? rnd(40, 150) : rnd(5, 20), c = rnd(3, a);
    return pick([
      () => ({ text: `${n} buys ${qty} notebooks for ₹${price} each. How much does ${he} spend?`, answer: qty * price }),
      () => ({ text: `${n} had ${a} ${t}. ${cap1(he)} bought ${b} more, then gave away ${c}. How many ${t} does ${n} have now?`, answer: a + b - c }),
      () => ({ text: `${n} has ₹${cash}. ${cap1(he)} buys ${qty} pens that cost ₹${price} each. How much money is left?`, answer: cash - qty * price }),
      () => ({ text: `Pencils cost ₹${price} each. How many pencils can ${n} buy with ₹${price * qty}?`, answer: qty }),
    ])();
  }
  const tag = big ? rnd(4, 40) * 50 : rnd(2, 12) * 10, off = big ? pick([15, 30, 35, 40, 60]) : pick([10, 20, 25, 50]);
  const den = pick([2, 3]);
  const [fa, fb] = big ? pick([[2, 3], [3, 4], [3, 5], [5, 6]]) : [1, den];
  const total = big ? fb * rnd(6, 20) : rnd(4, 8) * 6;
  const marks = big ? 80 : 40;
  return pick([
    () => ({ text: `A ₹${tag} toy is on sale for ${off}% off. How much does it cost now?`, answer: tag - (tag * off) / 100 }),
    () => ({ text: `${fa === 1 ? `One ${fb === 2 ? 'half' : 'third'}` : `${fa}/${fb}`} of the ${total} students in a class walk to school. How many students walk to school?`, answer: (total * fa) / fb }),
    () => ({ text: `${n} scored ${off}% on a test with ${marks} marks. How many marks did ${he} get?`, answer: (marks * off) / 100 }),
  ])();
}

// `level` is Easy/Medium/Hard (0-2); `grade` is the kid's CBSE class (1-8) or null.
// `accept` lets the caller skip problems (for example ones with negative answers).
export function makeRound(topicId, level, count = 10, accept = () => true, grade = null) {
  const topic = TOPICS.find((t) => t.id === topicId);
  const tier = tierFor(topic, grade, level);
  const seen = new Set();
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const text = gen(topic, tier);
    if (seen.has(text) || !accept(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

export { gcd };
