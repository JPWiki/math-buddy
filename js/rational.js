// Exact fractions so 1/3 + 1/3 + 1/3 is exactly 1, never 0.9999.

export class MathError extends Error {}

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

const LIMIT = 1e15;

export class Q {
  constructor(n, d = 1) {
    if (d === 0) throw new MathError("You can't divide by zero. Nobody can, not even a computer!");
    if (!Number.isFinite(n) || !Number.isFinite(d)) throw new MathError('That number is too big for me.');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
    if (Math.abs(this.n) > LIMIT || this.d > LIMIT) throw new MathError('That number is too big for me.');
  }

  static int(n) { return new Q(n, 1); }

  // "0.25" -> 25/100 -> 1/4
  static fromDecimal(text) {
    const neg = text.startsWith('-');
    const t = neg ? text.slice(1) : text;
    const [whole, frac = ''] = t.split('.');
    const d = 10 ** frac.length;
    const n = Number(whole || '0') * d + Number(frac || '0');
    return new Q(neg ? -n : n, d);
  }

  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Q(this.n * o.n, this.d * o.d); }
  div(o) {
    if (o.n === 0) throw new MathError("You can't divide by zero. Nobody can, not even a computer!");
    return new Q(this.n * o.d, this.d * o.n);
  }
  neg() { return new Q(-this.n, this.d); }
  abs() { return new Q(Math.abs(this.n), this.d); }
  inv() { return new Q(this.d, this.n); }
  pow(k) {
    if (k < 0) return this.inv().pow(-k);
    let r = Q.int(1);
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }

  eq(o) { return this.n === o.n && this.d === o.d; }
  isInt() { return this.d === 1; }
  isZero() { return this.n === 0; }
  sign() { return Math.sign(this.n); }
  valueOf() { return this.n / this.d; }

  // True when the decimal stops (denominator only has 2s and 5s).
  isTerminating() {
    let d = this.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    return d === 1;
  }

  decimalPlaces() {
    if (!this.isTerminating()) return Infinity;
    let p = 0;
    let q = this;
    while (!q.isInt()) { q = q.mul(Q.int(10)); p++; }
    return p;
  }

  toDecimal(maxPlaces = 6) {
    if (this.isTerminating() && this.decimalPlaces() <= maxPlaces) {
      const p = this.decimalPlaces();
      const scaled = Math.abs(this.n * (10 ** p) / this.d);
      let s = String(Math.round(scaled)).padStart(p + 1, '0');
      if (p) s = s.slice(0, -p) + '.' + s.slice(-p);
      return (this.n < 0 ? '-' : '') + s;
    }
    return String(Number((this.n / this.d).toFixed(3)));
  }

  toFraction() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }

  // { neg, whole, n, d } for showing 7/3 as 2 1/3
  mixedParts() {
    const a = Math.abs(this.n);
    return { neg: this.n < 0, whole: Math.floor(a / this.d), n: a % this.d, d: this.d };
  }
}
