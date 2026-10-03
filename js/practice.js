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
      return pick([`${a}(x + ${b}) = ${a * (x + b)}`, `${a}x + ${b} = ${c}x + ${a * x + b - c * x}`]);
    },
  },
];

// `accept` lets the caller skip problems (for example ones with negative answers).
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
