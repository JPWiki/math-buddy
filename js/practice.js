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

export const TOPICS = [
  {
    id: 'add', name: 'Addition', sample: '347 + 285',
    gen: (lv) => {
      const r = [[10, 99], [100, 999], [1000, 9999]][lv];
      return `${rnd(...r)} + ${rnd(...r)}`;
    },
  },
  {
    id: 'sub', name: 'Subtraction', sample: '503 − 278',
    gen: (lv) => {
      const r = [[10, 99], [100, 999], [1000, 9999]][lv];
      const a = rnd(...r), b = rnd(...r);
      return `${Math.max(a, b)} − ${Math.min(a, b)}`;
    },
  },
  {
    id: 'times', name: 'Times tables', sample: '7 × 8',
    gen: (lv) => {
      if (lv === 2) return `${rnd(12, 99)} × ${rnd(3, 9)}`;
      const top = lv === 0 ? 10 : 12;
      return `${rnd(2, top)} × ${rnd(2, top)}`;
    },
  },
  {
    id: 'longmul', name: 'Big multiplying', sample: '236 × 45',
    gen: (lv) => [() => `${rnd(12, 99)} × ${rnd(2, 9)}`, () => `${rnd(12, 99)} × ${rnd(12, 99)}`, () => `${rnd(102, 999)} × ${rnd(12, 99)}`][lv](),
  },
  {
    id: 'div', name: 'Division', sample: '84 ÷ 7',
    gen: (lv) => {
      const [b, q] = [[rnd(2, 10), rnd(2, 10)], [rnd(2, 9), rnd(11, 40)], [rnd(3, 9), rnd(21, 199)]][lv];
      return `${b * q} ÷ ${b}`;
    },
  },
  {
    id: 'order', name: 'Order of operations', sample: '2 + 3 × (8 − 2)',
    gen: (lv) => {
      const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(1, 9);
      if (lv === 0) return pick([`${a} + ${b} × ${c}`, `${a * b + c} − ${a} × ${b}`, `${a} × ${b} + ${c}`]);
      if (lv === 1) return pick([`(${a} + ${b}) × ${c}`, `${a} × (${b + c} − ${c})`, `${a} + ${b} × ${c} − ${d}`, `${c * a} ÷ ${c} + ${b}`]);
      return pick([`${a}^2 + ${b} × ${c}`, `(${a} + ${b}) × ${c} − ${d}^2`, `${c * (a + b)} ÷ (${a} + ${b}) + ${d}`, `${rnd(2, 5)}^3 − ${a} × ${b}`]);
    },
  },
  {
    id: 'fracadd', name: 'Adding fractions', sample: '3/4 + 1/6',
    gen: (lv) => {
      if (lv === 0) {
        const d = rnd(3, 12);
        const a = rnd(1, d - 1), b = rnd(1, d - 1);
        return Math.random() < 0.5 || a === b ? `${a}/${d} + ${b}/${d}` : `${Math.max(a, b)}/${d} − ${Math.min(a, b)}/${d}`;
      }
      if (lv === 1) {
        const dens = [2, 3, 4, 5, 6, 8, 10, 12];
        let [a, b] = properFrac(dens), [c, d] = properFrac(dens);
        while (b === d) [c, d] = properFrac(dens);
        if (Math.random() < 0.5) return `${a}/${b} + ${c}/${d}`;
        return a / b >= c / d ? `${a}/${b} − ${c}/${d}` : `${c}/${d} − ${a}/${b}`;
      }
      const [a, b] = properFrac([2, 3, 4, 5, 6]), [c, d] = properFrac([2, 3, 4, 6, 8]);
      return `${rnd(1, 4)} ${a}/${b} + ${rnd(1, 3)} ${c}/${d}`;
    },
  },
  {
    id: 'fracmul', name: 'Multiplying fractions', sample: '12 × 3/4',
    gen: (lv) => {
      const [a, b] = properFrac([2, 3, 4, 5, 6, 8, 10]);
      if (lv === 0) return `${b * rnd(1, 6)} × ${a}/${b}`;
      const [c, d] = properFrac([2, 3, 4, 5, 6, 8, 9]);
      return lv === 1 ? `${a}/${b} × ${c}/${d}` : `${a}/${b} ÷ ${c}/${d}`;
    },
  },
  {
    id: 'dec', name: 'Decimals', sample: '3.5 + 12.25',
    gen: (lv) => {
      const d1 = () => dec(11, 99, 1);
      const d2 = () => dec(101, 999, 2);
      if (lv === 0) return `${d1()} + ${d1()}`;
      if (lv === 1) {
        const a = Number(d2()), b = Number(d1());
        return Math.random() < 0.5 ? `${a.toFixed(2)} + ${b.toFixed(1)}` : `${Math.max(a, b)} − ${Math.min(a, b)}`;
      }
      const dv = rnd(2, 5);
      return pick([`${d1()} × ${rnd(2, 9)}`, `${dec(11, 49, 1)} × ${dec(11, 29, 1)}`, `${(rnd(3, 30) * dv) / 10} ÷ 0.${dv}`]);
    },
  },
  {
    id: 'pct', name: 'Percents', sample: '25% of 80',
    gen: (lv) => {
      const p = [pick([10, 50, 25, 100]), pick([20, 75, 5, 30, 40]), rnd(1, 19) * 5][lv];
      return `${p}% of ${rnd(1, 15) * 20}`;
    },
  },
  {
    id: 'words', name: 'Word problems', sample: '6 friends share 24…',
    gen: (lv) => wordProblem(lv).text,
  },
  {
    id: 'eq', name: 'Missing numbers', sample: '3x + 5 = 20',
    gen: (lv) => {
      const x = rnd(2, 12);
      if (lv === 0) {
        const a = rnd(2, 12);
        return pick([`? + ${a} = ${x + a}`, `? × ${a} = ${x * a}`, `${x + a} − ? = ${a}`]);
      }
      const a = rnd(2, 9), b = rnd(1, 20);
      if (lv === 1) return Math.random() < 0.5 ? `${a}x + ${b} = ${a * x + b}` : `${a}x − ${b} = ${a * x - b}`;
      const c = rnd(1, a - 1 || 1);
      return pick([`${a}(x + ${b}) = ${a * (x + b)}`, `${a}x + ${b} = ${c === 1 ? '' : c}x + ${a * x + b - c * x}`]);
    },
  },
];

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
export function wordProblem(level) {
  const [[n, he], [m]] = twoKids();
  const t = pick(THINGS);
  if (level === 0) {
    const a = rnd(12, 60), b = rnd(5, 30);
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

export function makeRound(topicId, level, count = 10, accept = () => true) {
  const topic = TOPICS.find((t) => t.id === topicId);
  const seen = new Set();
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const text = topic.gen(level);
    if (seen.has(text) || !accept(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

export { gcd };
