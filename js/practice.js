// Practice problem makers. Each returns the problem as text; the solver works out the answer,
// so the "See how" steps and the answer always agree.

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

// School years 1 to 8, with the usual ages, so grown-ups can pick either.
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
export const gradeLabel = (g) => `Grade ${g}`;
export const gradeAges = (g) => `age ${g + 5}–${g + 6}`;

const between = (lo, hi) => () => rnd(lo, hi);
const digits = (n) => between(10 ** (n - 1), 10 ** n - 1);
const minus = (x, y) => `${Math.max(x, y)} − ${Math.min(x, y)}`;
const nz = (lo, hi) => { let v = 0; while (!v) v = rnd(lo, hi); return v; };
const sgn = (v) => (v < 0 ? `(−${-v})` : `${v}`);
const lead = (v) => (v < 0 ? `−${-v}` : `${v}`);

// Every topic has five steps of difficulty (tiers 0-4) and the school years it belongs to.
// In a topic's first grade, Easy/Medium/Hard are tiers 0/1/2; each grade after that moves
// them up one tier (up to tier 4), so the same topic keeps growing with the kid.
export const TOPICS = [
  {
    id: 'add', name: 'Addition', sample: '347 + 285', grades: [1, 4],
    gen: (t) => {
      const make = [
        () => `${rnd(2, 9)} + ${rnd(1, 9)}`,
        () => `${rnd(11, 89)} + ${rnd(2, 9)}`,
        () => `${digits(2)()} + ${digits(2)()}`,
        () => `${digits(3)()} + ${digits(3)()}`,
        () => `${digits(4)()} + ${digits(4)()}`,
      ];
      return make[t]();
    },
  },
  {
    id: 'sub', name: 'Subtraction', sample: '503 − 278', grades: [1, 4],
    gen: (t) => {
      const make = [
        () => { const a = rnd(5, 20); return `${a} − ${rnd(1, Math.min(9, a - 1))}`; },
        () => `${rnd(21, 99)} − ${rnd(2, 9)}`,
        () => minus(digits(2)(), digits(2)()),
        () => minus(digits(3)(), digits(3)()),
        () => minus(digits(4)(), digits(4)()),
      ];
      return make[t]();
    },
  },
  {
    id: 'times', name: 'Times tables', sample: '7 × 8', grades: [2, 5],
    gen: (t) => {
      const make = [
        () => `${pick([2, 5, 10])} × ${rnd(1, 10)}`,
        () => `${rnd(2, 5)} × ${rnd(2, 10)}`,
        // All the facts up to 12 x 12, mostly the tricky ones (6-9, 12) rather than x10 and x11.
        () => {
          let a = rnd(3, 12), b = rnd(3, 12);
          while ((a === 10 || a === 11 || b === 10 || b === 11) && Math.random() < 0.8) { a = rnd(3, 12); b = rnd(3, 12); }
          return `${a} × ${b}`;
        },
        () => `${rnd(13, 99)} × ${rnd(3, 9)}`,
        () => pick([`${rnd(102, 999)} × ${rnd(3, 9)}`, `${rnd(13, 19)} × ${rnd(13, 19)}`]),
      ];
      return make[t]();
    },
  },
  {
    id: 'div', name: 'Division', sample: '84 ÷ 7', grades: [3, 6],
    gen: (t) => {
      const [b, q] = [
        [rnd(2, 5), rnd(2, 10)],
        [rnd(2, 10), rnd(2, 10)],
        [rnd(3, 12), rnd(3, 12)],
        [rnd(3, 9), rnd(13, 99)],
        pick([[rnd(3, 9), rnd(101, 999)], [rnd(11, 25), rnd(12, 40)]]),
      ][t];
      return `${b * q} ÷ ${b}`;
    },
  },
  {
    id: 'longmul', name: 'Big multiplying', sample: '236 × 45', grades: [4, 7],
    gen: (t) => [
      () => `${rnd(12, 99)} × ${rnd(2, 9)}`,
      () => `${rnd(102, 999)} × ${rnd(2, 9)}`,
      () => `${rnd(12, 99)} × ${rnd(12, 99)}`,
      () => `${rnd(102, 999)} × ${rnd(12, 99)}`,
      () => `${rnd(102, 999)} × ${rnd(102, 999)}`,
    ][t](),
  },
  {
    id: 'fracadd', name: 'Adding fractions', sample: '3/4 + 1/6', grades: [3, 7],
    gen: (t) => {
      if (t <= 1) {
        const d = t === 0 ? rnd(3, 8) : rnd(5, 12);
        let a = rnd(1, d - 1), b = rnd(1, d - 1);
        if (t === 0) while (a + b > d) { a = rnd(1, d - 1); b = rnd(1, d - 1); }
        return Math.random() < 0.6 || a === b ? `${a}/${d} + ${b}/${d}` : `${Math.max(a, b)}/${d} − ${Math.min(a, b)}/${d}`;
      }
      if (t <= 3) {
        const dens = t === 2 ? [2, 3, 4, 6, 8] : [2, 3, 4, 5, 6, 8, 9, 10, 12];
        let [a, b] = properFrac(dens), [c, d] = properFrac(dens);
        while (b === d) [c, d] = properFrac(dens);
        if (t === 2 || Math.random() < 0.5) return `${a}/${b} + ${c}/${d}`;
        return a / b >= c / d ? `${a}/${b} − ${c}/${d}` : `${c}/${d} − ${a}/${b}`;
      }
      const [a, b] = properFrac([2, 3, 4, 5, 6]), [c, d] = properFrac([2, 3, 4, 6, 8]);
      const w1 = rnd(2, 5), w2 = rnd(1, w1 - 1);
      return Math.random() < 0.5 ? `${w1} ${a}/${b} + ${w2} ${c}/${d}` : `${w1} ${a}/${b} − ${w2} ${c}/${d}`;
    },
  },
  {
    id: 'dec', name: 'Decimals', sample: '3.5 + 12.25', grades: [4, 8],
    gen: (t) => {
      const d1 = () => dec(11, 99, 1);
      const d2 = () => dec(101, 999, 2);
      if (t === 0) return `${d1()} + ${d1()}`;
      if (t === 1) {
        const a = Number(d2()), b = Number(d1());
        return Math.random() < 0.5 ? `${a} + ${b}` : `${Math.max(a, b)} − ${Math.min(a, b)}`;
      }
      if (t === 2) return pick([`${d1()} × ${rnd(2, 9)}`, `${d2()} × ${pick([10, 100])}`]);
      if (t === 3) {
        const dv = rnd(3, 9);
        let k = rnd(11, 99);
        while ((k * dv) % 10 === 0) k = rnd(11, 99);
        return pick([`${dec(11, 49, 1)} × ${dec(11, 29, 1)}`, `${((k * dv) / 10).toFixed(1)} ÷ ${dv}`]);
      }
      const dv = rnd(2, 5);
      return pick([`${(rnd(3, 30) * dv) / 10} ÷ 0.${dv}`, `${dec(101, 999, 2)} × ${dec(11, 99, 1)}`]);
    },
  },
  {
    id: 'order', name: 'Order of operations', sample: '2 + 3 × (8 − 2)', grades: [4, 8],
    gen: (t) => {
      const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(1, 9);
      return pick([
        [`${a} + ${b} × ${c}`, `${a * b + c} − ${a} × ${b}`, `${a} × ${b} + ${c}`],
        [`(${a} + ${b}) × ${c}`, `${a} × (${b + c} − ${c})`, `${c * a} ÷ ${c} + ${b}`],
        [`${a} + ${b} × ${c} − ${d}`, `(${a} + ${b}) × ${c} − ${d}`, `${c * (a + b)} ÷ (${a} + ${b}) + ${d}`],
        [`${a}^2 + ${b} × ${c}`, `(${a} + ${b}) × ${c} − ${d}^2`, `${rnd(2, 5)}^3 − ${a} × ${b}`],
        [`${a}^2 − (${b} + ${c})^2 ÷ ${b + c}`, `−${a} × ${b} + ${c}^2`, `(${d} − ${a + d}) × ${b} + ${c}`],
      ][t]);
    },
  },
  {
    id: 'fracmul', name: 'Multiplying fractions', sample: '12 × 3/4', grades: [5, 8],
    gen: (t) => {
      const [a, b] = properFrac([2, 3, 4, 5, 6, 8, 10]);
      const [c, d] = properFrac([2, 3, 4, 5, 6, 8, 9]);
      return [
        () => `${b * rnd(1, 6)} × ${a}/${b}`,
        () => `${a}/${b} × ${c}/${d}`,
        () => pick([`${a}/${b} ÷ ${rnd(2, 6)}`, `${rnd(2, 6)} ÷ ${a}/${b}`]),
        () => `${a}/${b} ÷ ${c}/${d}`,
        () => pick([`${rnd(1, 3)} ${a}/${b} × ${rnd(1, 3)} ${c}/${d}`, `${rnd(1, 4)} ${a}/${b} ÷ ${c}/${d}`]),
      ][t]();
    },
  },
  {
    id: 'pct', name: 'Percents', sample: '25% of 80', grades: [6, 8],
    gen: (t) => {
      const n = rnd(1, 15) * 20;
      return [
        () => `${pick([10, 50, 25, 100])}% of ${n}`,
        () => `${pick([20, 75, 5, 30, 40])}% of ${n}`,
        () => `${rnd(1, 19) * 5}% of ${n}`,
        () => `${rnd(1, 99)}% of ${rnd(1, 9) * 100}`,
        () => `${pick([12.5, 2.5, 7.5, 150, 120])}% of ${rnd(1, 12) * 40}`,
      ][t]();
    },
  },
  {
    id: 'neg', name: 'Negative numbers', sample: '−5 + 8', grades: [6, 8],
    gen: (t) => {
      // At least one negative number in every problem.
      const x = -rnd(1, 12), y = nz(-12, 12);
      return [
        () => `${lead(-rnd(1, 9))} + ${rnd(1, 15)}`,
        () => pick([`${rnd(1, 9)} − ${rnd(10, 20)}`, `${lead(-rnd(1, 9))} − ${rnd(1, 9)}`, `${rnd(1, 9)} − ${sgn(-rnd(1, 9))}`]),
        () => pick([`${lead(y)} × ${sgn(x)}`, `${lead(x * y)} ÷ ${sgn(y)}`, `${lead(x * y)} ÷ ${sgn(x)}`]),
        () => pick([`${lead(x)} + ${sgn(y)} × ${rnd(2, 5)}`, `(${lead(x)} − ${sgn(y)}) × ${sgn(nz(-5, 5))}`]),
        () => pick([`${lead(nz(-30, 30))} − ${sgn(nz(-30, 30))} × ${sgn(nz(-9, 9))}`, `${sgn(x)}^2 − ${rnd(2, 4)}^3`]),
      ][t]();
    },
  },
  {
    id: 'eq', name: 'Missing numbers', sample: '3x + 5 = 20', grades: [3, 8],
    gen: (t) => {
      const x = rnd(2, 12);
      const a = rnd(2, 9), b = rnd(1, 20);
      return [
        () => { const k = rnd(2, 20); return pick([`? + ${k} = ${x + k}`, `${x + k} − ? = ${k}`]); },
        () => pick([`? × ${a} = ${x * a}`, `? ÷ ${a} = ${x}`]),
        () => (Math.random() < 0.5 ? `${a}x + ${b} = ${a * x + b}` : `${a}x − ${Math.min(b, a * x - 1)} = ${a * x - Math.min(b, a * x - 1)}`),
        () => { const k = rnd(2, 9); return pick([`${a}(x + ${b}) = ${a * (x + b)}`, `x/${a} + ${b} = ${k + b}`]); },
        () => {
          const c = rnd(1, a - 1 || 1), d = rnd(1, x - 1);
          return pick([`${a}x + ${b} = ${c === 1 ? '' : c}x + ${a * x + b - c * x}`, `${a}(x − ${d}) = ${a * (x - d)}`]);
        },
      ][t]();
    },
  },
  {
    id: 'words', name: 'Word problems', sample: '6 friends share 24…', grades: [1, 8],
    gen: (t) => wordProblem([0, 0, 1, 2, 2][t], t === 0).text,
  },
];

// Which tier a kid gets for a topic at their grade and the level they picked.
// Each grade moves the topic up a tier (at most two), so Easy, Medium and Hard
// always stay different. No grade set: Easy/Medium/Hard are tiers 1/2/3.
export function tierFor(topic, grade, level) {
  if (!grade) return Math.min(4, level + 1);
  return Math.min(4, Math.max(0, Math.min(2, grade - topic.grades[0])) + level);
}

// Negative answers only where kids have learned them.
export const allowsNegatives = (topic, grade) => topic.id === 'neg' || (grade || 0) >= 6;

export const inGrade = (topic, grade) => !grade || (grade >= topic.grades[0] && grade <= topic.grades[1]);

// `accept` lets the caller skip problems (for example ones with negative answers).
// ---------- word problems ----------

const KIDS = [['Maya', 'she'], ['Leo', 'he'], ['Aria', 'she'], ['Sam', 'he'], ['Zoe', 'she'], ['Omar', 'he'], ['Priya', 'she'], ['Ben', 'he'], ['Lily', 'she'], ['Arjun', 'he']];
const THINGS = ['stickers', 'marbles', 'cards', 'shells', 'stamps', 'beads', 'crayons', 'cookies', 'apples', 'books'];
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

function twoKids() {
  const a = pick(KIDS);
  let b = pick(KIDS);
  while (b === a) b = pick(KIDS);
  return [a, b];
}

// Returns { text, answer } so tests can check the reader gets the right answer.
// `small` keeps the numbers under 20 for the youngest kids.
export function wordProblem(level, small = false) {
  const [[n, he], [m]] = twoKids();
  const t = pick(THINGS);
  if (level === 0) {
    const a = small ? rnd(3, 12) : rnd(12, 60), b = small ? rnd(2, 8) : rnd(5, 30);
    return pick([
      () => ({ text: `${n} has ${a} ${t}. ${cap1(he)} gets ${b} more. How many ${t} does ${n} have now?`, answer: a + b }),
      () => ({ text: `${n} had ${a + b} ${t}. ${cap1(he)} gave ${b} to ${m}. How many ${t} are left?`, answer: a }),
      () => ({ text: `There are ${a + b} kids on the bus. At the next stop, ${b} get off. How many kids are still on the bus?`, answer: a }),
      () => ({ text: `${n} read ${a} pages on Monday and ${b} pages on Tuesday. How many pages did ${he} read in all?`, answer: a + b }),
      () => ({ text: `${n} picked ${a} apples and ${m} picked ${b} apples. How many apples did they pick altogether?`, answer: a + b }),
      () => ({ text: `A shop had ${a + b} balloons. It sold ${b}. How many balloons does the shop have left?`, answer: a }),
    ])();
  }
  if (level === 1) {
    const g = rnd(3, 9), k = rnd(3, 12);
    const a = rnd(30, 90), b = rnd(10, a - 5);
    return pick([
      () => ({ text: `Each box holds ${k} ${t}. How many ${t} are in ${g} boxes?`, answer: g * k }),
      () => ({ text: `${n} shares ${g * k} ${t} equally among ${g} friends. How many ${t} does each friend get?`, answer: k }),
      () => ({ text: `${n} has ${a} ${t}. ${m} has ${b} ${t}. How many more ${t} does ${n} have than ${m}?`, answer: a - b }),
      () => ({ text: `There are ${g} rows of chairs with ${k} chairs in each row. How many chairs are there in all?`, answer: g * k }),
      () => ({ text: `There are ${g * k} students split into teams of ${k}. How many teams are there?`, answer: g }),
      () => ({ text: `${n} reads ${k} pages a day for ${g} days. How many pages does ${he} read?`, answer: g * k }),
    ])();
  }
  const price = rnd(2, 9), qty = rnd(2, 6), cash = price * qty + rnd(1, 15);
  const a = rnd(20, 50), b = rnd(5, 20), c = rnd(3, a);
  const tag = rnd(2, 12) * 10, off = pick([10, 20, 25, 50]);
  const cls = rnd(4, 8) * 6, den = pick([2, 3]);
  return pick([
    () => ({ text: `${n} buys ${qty} notebooks for $${price} each. How much does ${he} spend?`, answer: qty * price }),
    () => ({ text: `${n} had ${a} ${t}. ${cap1(he)} bought ${b} more, then gave away ${c}. How many ${t} does ${n} have now?`, answer: a + b - c }),
    () => ({ text: `A $${tag} toy is on sale for ${off}% off. How much does it cost now?`, answer: tag - (tag * off) / 100 }),
    () => ({ text: `${n} has $${cash}. ${cap1(he)} buys ${qty} pens that cost $${price} each. How much money is left?`, answer: cash - qty * price }),
    () => ({ text: `One ${den === 2 ? 'half' : 'third'} of the ${cls} students in a class walk to school. How many students walk to school?`, answer: cls / den }),
    () => ({ text: `Pencils cost $${price} each. How many pencils can ${n} buy with $${price * qty}?`, answer: qty }),
  ])();
}

// `level` is Easy/Medium/Hard (0-2); `grade` is the kid's school year (1-8) or null.
export function makeRound(topicId, level, count = 10, accept = () => true, grade = null) {
  const topic = TOPICS.find((t) => t.id === topicId);
  const tier = tierFor(topic, grade, level);
  const seen = new Set();
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const text = topic.gen(tier);
    if (seen.has(text) || !accept(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

export { gcd };
