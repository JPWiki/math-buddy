// One operation at a time, explained the way a teacher would at a whiteboard.
// Each function returns { q, kind, lines: [html], hint }.

import { Q, MathError, gcd, lcm } from './rational.js';
import { group, fracHTML, numHTML, numNodeHTML, MINUS } from './format.js';

const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions', 'ten-millions', 'hundred-millions'];
const DEC_PLACES = ['tenths', 'hundredths', 'thousandths', 'ten-thousandths', 'hundred-thousandths', 'millionths'];
const T = '×';
const D = '÷';

function placeName(i, decimals = 0) {
  const k = i - decimals;
  return k >= 0 ? PLACES[k] || `place ${k + 1}` : DEC_PLACES[-k - 1] || 'decimal place';
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const m = (html) => `<span class="m">${html}</span>`;
const n = (x) => group(x);

function digitsOf(x) {
  return String(Math.abs(x)).split('').reverse().map(Number);
}

// Puts a decimal point into a scaled integer: (1575, 2) -> "15.75"
function withPoint(x, decimals) {
  if (!decimals) return String(x);
  const s = String(Math.abs(x)).padStart(decimals + 1, '0');
  return (x < 0 ? '-' : '') + s.slice(0, -decimals) + '.' + s.slice(-decimals);
}

// A little column-arithmetic grid, like on paper.
function columnGrid({ top, bottom, result, op, decimals = 0, marks = null, markCls = 'carry' }) {
  const strs = [top, bottom, result].map((x) => withPoint(x, decimals));
  const width = Math.max(...strs.map((s) => s.length)) + 1;
  const cells = (s) => {
    const arr = s.split('');
    while (arr.length < width) arr.unshift('');
    return arr;
  };
  const toRow = (arr, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}>${arr.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  let rows = '';
  if (marks) {
    // marks: digit index (ones = 0) -> small text, mapped onto grid columns.
    const arr = new Array(width).fill('');
    const pointCol = decimals ? width - decimals - 1 : width;
    for (const [i, v] of Object.entries(marks)) {
      let col = width - 1 - Number(i);
      if (decimals && col <= pointCol) col -= 1;
      if (col >= 0) arr[col] = `<small>${v}</small>`;
    }
    rows += toRow(arr, markCls);
  }
  const b = cells(strs[1]);
  b[0] = op;
  rows += toRow(cells(strs[0])) + toRow(b, 'op') + toRow(cells(strs[2]), 'total');
  return `<div class="col-scroll"><table class="col-work" aria-hidden="true">${rows}</table></div>`;
}

// ---------- whole numbers ----------

function columnAdd(x, y, decimals = 0) {
  const a = digitsOf(x);
  const b = digitsOf(y);
  const sum = x + y;
  const len = Math.max(a.length, b.length);
  const carries = {};
  const lines = [];
  let carry = 0;
  for (let i = 0; i < len; i++) {
    const da = a[i] || 0;
    const db = b[i] || 0;
    const s = da + db + carry;
    const place = cap(placeName(i, decimals));
    const parts = [a[i] !== undefined ? da : null, b[i] !== undefined ? db : null].filter((v) => v !== null);
    let expr = parts.join(' + ');
    if (carry) expr += ` + ${carry} <span class="note">(carried)</span>`;
    const isLast = i === len - 1;
    if (parts.length === 1 && !carry) {
      lines.push(`${place}: nothing to add, bring down the ${s}.`);
      continue;
    }
    if (s >= 10 && !isLast) {
      lines.push(`${place}: ${m(`${expr} = ${s}`)}. Write ${s % 10}, carry 1 to the ${placeName(i + 1, decimals)}.`);
      carries[i + 1] = 1;
      carry = 1;
    } else {
      lines.push(`${place}: ${m(`${expr} = ${s}`)}. Write ${s}.`);
      carry = 0;
    }
  }
  const grid = columnGrid({ top: x, bottom: y, result: sum, op: '+', decimals, marks: Object.keys(carries).length ? carries : null });
  return { sum, lines: len > 7 ? [grid] : [grid, ...lines] };
}

function columnSub(x, y, decimals = 0) {
  const a = digitsOf(x);
  const b = digitsOf(y);
  const work = [...a];
  const lines = [];
  for (let i = 0; i < a.length; i++) {
    const db = b[i] || 0;
    const place = cap(placeName(i, decimals));
    if (work[i] < db) {
      let j = i + 1;
      while (work[j] === 0) j++;
      work[j] -= 1;
      for (let k = j - 1; k > i; k--) work[k] = 9;
      work[i] += 10;
      const zeros = [];
      for (let k = i + 1; k < j; k++) zeros.push(placeName(k, decimals));
      const via = zeros.length ? ` (the ${zeros.join(' and ')} ${zeros.length > 1 ? 'are' : 'is'} 0, so borrow from the ${placeName(j, decimals)})` : '';
      lines.push(`${place}: ${work[i] - 10} is smaller than ${db}, so borrow 1 from the ${placeName(i + 1, decimals)}${via}. Now ${m(`${work[i]} ${MINUS} ${db} = ${work[i] - db}`)}.`);
    } else if (i === a.length - 1 && work[i] === 0 && i >= b.length) {
      // A leading zero after borrowing: nothing to write.
    } else if (i < b.length || work[i] !== a[i]) {
      lines.push(`${place}: ${m(`${work[i]} ${MINUS} ${db} = ${work[i] - db}`)}.`);
    } else if (work[i] !== 0 || i < a.length - 1) {
      lines.push(`${place}: nothing to take away, bring down ${work[i]}.`);
    }
  }
  const marks = {};
  work.forEach((v, i) => { if (v !== a[i]) marks[i] = v; });
  const diff = x - y;
  const grid = columnGrid({ top: x, bottom: y, result: diff, op: MINUS, decimals, marks: Object.keys(marks).length ? marks : null, markCls: 'borrow' });
  return { diff, lines: a.length > 7 ? [grid] : [grid, ...lines] };
}

function smallAdd(x, y) {
  const big = Math.max(x, y);
  const small = Math.min(x, y);
  const s = x + y;
  const toTen = (10 - (big % 10)) % 10;
  if (small > 1 && toTen && small > toTen && Math.floor(big / 10) !== Math.floor(s / 10)) {
    return [`Make a ten: ${m(`${big} + ${toTen} = ${big + toTen}`)}, then ${small - toTen} more makes ${m(n(s))}.`];
  }
  return [`${m(`${n(x)} + ${n(y)} = ${n(s)}`)}`];
}

function addNonNeg(x, y, decimals = 0) {
  if (!decimals && (x < 10 || y < 10)) return { sum: x + y, lines: smallAdd(x, y) };
  const r = columnAdd(x, y, decimals);
  return { sum: r.sum, lines: ['Line the numbers up by place value and add, starting from the right.', ...r.lines] };
}

function subNonNeg(x, y, decimals = 0) {
  if (!decimals && x < 20 && y < 10) return { diff: x - y, lines: [`${m(`${n(x)} ${MINUS} ${n(y)} = ${n(x - y)}`)}. <span class="note">Check: ${n(x - y)} + ${n(y)} = ${n(x)}</span>`] };
  const r = columnSub(x, y, decimals);
  return { diff: r.diff, lines: ['Line the numbers up by place value and subtract, starting from the right.', ...r.lines] };
}

const fmtScaled = (v, decimals) => (decimals ? withPoint(v, decimals).replace('-', MINUS) : n(v));

// x and y are integers (scaled by 10^decimals for decimal numbers).
export function addSubScaled(op, x, y, decimals = 0) {
  const f = (v) => fmtScaled(v, decimals);
  if (op === '+') {
    if (x >= 0 && y >= 0) { const r = addNonNeg(x, y, decimals); return { v: r.sum, lines: r.lines }; }
    if (x < 0 && y < 0) {
      const r = addNonNeg(-x, -y, decimals);
      return { v: -r.sum, lines: [`Both numbers are negative. Add ${f(-x)} + ${f(-y)}, then keep the minus sign.`, ...r.lines, `So the answer is ${m(f(-r.sum))}.`] };
    }
    if (y < 0) {
      const r = addSubScaled('-', x, -y, decimals);
      return { v: r.v, lines: [`Adding a negative number is the same as subtracting: ${m(`${f(x)} + (${f(y)}) = ${f(x)} ${MINUS} ${f(-y)}`)}.`, ...r.lines] };
    }
    const r = addSubScaled('-', y, -x, decimals);
    return { v: r.v, lines: [`Swap the order so the negative is taken away: ${m(`${f(x)} + ${f(y)} = ${f(y)} ${MINUS} ${f(-x)}`)}.`, ...r.lines] };
  }
  if (y < 0) {
    const r = addSubScaled('+', x, -y, decimals);
    return { v: r.v, lines: [`Taking away a negative is the same as adding: ${m(`${f(x)} ${MINUS} (${f(y)}) = ${f(x)} + ${f(-y)}`)}.`, ...r.lines] };
  }
  if (x < 0) {
    const r = addNonNeg(-x, y, decimals);
    return { v: -r.sum, lines: [`We start below zero and go down ${f(y)} more. Add ${f(-x)} + ${f(y)}, then keep the minus sign.`, ...r.lines, `So the answer is ${m(f(-r.sum))}.`] };
  }
  if (x >= y) { const r = subNonNeg(x, y, decimals); return { v: r.diff, lines: r.lines }; }
  const r = subNonNeg(y, x, decimals);
  return { v: -r.diff, lines: [`${f(y)} is bigger than ${f(x)}, so the answer will be negative. Work out ${f(y)} ${MINUS} ${f(x)}, then put a minus sign in front.`, ...r.lines, `So ${m(`${f(x)} ${MINUS} ${f(y)} = ${f(-r.diff)}`)}.`] };
}

function isPow10(x) {
  return x >= 10 && /^10*$/.test(String(x));
}

// Splits 236 into [200, 30, 6]
function placeParts(x) {
  const s = String(x);
  return s.split('').map((d, i) => Number(d) * 10 ** (s.length - 1 - i)).filter((v) => v);
}

function mulNonNeg(x, y) {
  const p = x * y;
  if (x === 0 || y === 0) return { p, lines: [`Anything times 0 is 0: ${m(`${n(x)} ${T} ${n(y)} = 0`)}.`], hint: 'What happens when you multiply by 0?' };
  if (x === 1 || y === 1) return { p, lines: [`Anything times 1 stays the same: ${m(`${n(x)} ${T} ${n(y)} = ${n(p)}`)}.`], hint: 'What happens when you multiply by 1?' };
  if (x <= 12 && y <= 12) {
    const lines = [`Times table fact: ${m(`${x} ${T} ${y} = ${p}`)}.`];
    if (Math.min(x, y) <= 4 && Math.max(x, y) > 2) {
      const [a, b] = x >= y ? [x, y] : [y, x];
      lines.push(`<span class="note">That's ${b} groups of ${a}: ${Array(b).fill(a).join(' + ')} = ${p}</span>`);
    }
    return { p, lines, hint: `Use your ${Math.max(x, y) === 12 || Math.max(x, y) === 11 ? Math.min(x, y) : Math.max(x, y)} times table.` };
  }
  if (isPow10(y) || isPow10(x)) {
    const [a, b] = isPow10(y) ? [x, y] : [y, x];
    const zeros = String(b).length - 1;
    return { p, lines: [`Multiplying by ${n(b)} puts ${zeros === 1 ? 'a zero' : `${zeros} zeros`} on the end: ${m(`${n(a)} ${T} ${n(b)} = ${n(p)}`)}.`], hint: `What happens to a number when you multiply it by ${n(b)}?` };
  }
  const tz = (v) => { let c = 0; while (v % 10 === 0 && v) { v /= 10; c++; } return c; };
  const zx = tz(x), zy = tz(y);
  if (zx + zy > 0 && (x / 10 ** zx) <= 12 && (y / 10 ** zy) <= 12) {
    const a = x / 10 ** zx, b = y / 10 ** zy;
    return { p, lines: [`Ignore the zeros first: ${m(`${a} ${T} ${b} = ${a * b}`)}.`, `Then put back the ${zx + zy} zero${zx + zy > 1 ? 's' : ''}: ${m(`${n(x)} ${T} ${n(y)} = ${n(p)}`)}.`], hint: 'Multiply without the zeros, then add them back on.' };
  }
  // Keep the smaller number whole and break the bigger one apart.
  const [big, small] = x >= y ? [x, y] : [y, x];
  if (small <= 12) {
    const parts = placeParts(big);
    const prods = parts.map((pt) => pt * small);
    return {
      p,
      lines: [
        `Break ${n(big)} into place-value parts: ${m(parts.map(n).join(' + '))}.`,
        `Multiply each part by ${small}: ${parts.map((pt, i) => m(`${n(pt)} ${T} ${small} = ${n(prods[i])}`)).join(', ')}.`,
        `Add them up: ${m(`${prods.map(n).join(' + ')} = ${n(p)}`)}.`,
      ],
      hint: `Break ${n(big)} into ${parts.map(n).join(' + ')} and multiply each part by ${small}.`,
    };
  }
  const parts = placeParts(small);
  const prods = parts.map((pt) => pt * big);
  return {
    p,
    lines: [
      `Split ${n(small)} into ${m(parts.map(n).join(' + '))} and multiply ${n(big)} by each part (long multiplication).`,
      ...parts.map((pt, i) => m(`${n(big)} ${T} ${n(pt)} = ${n(prods[i])}`)),
      `Add the partial products: ${m(`${prods.map(n).join(' + ')} = ${n(p)}`)}.`,
    ],
    hint: `Split ${n(small)} into ${parts.map(n).join(' + ')}. Multiply ${n(big)} by each part, then add.`,
  };
}

export function mulInts(x, y) {
  const r = mulNonNeg(Math.abs(x), Math.abs(y));
  const p = x * y;
  const lines = [...r.lines];
  if (x < 0 || y < 0) {
    const negs = (x < 0) + (y < 0);
    lines.unshift(negs === 2 ? 'Negative times negative makes a positive.' : 'Negative times positive makes a negative.');
    if (p !== r.p) lines.push(`So the answer is ${m(n(p))}.`);
  }
  return { v: p, lines, hint: r.hint };
}

function longDivision(x, y) {
  const digits = String(x).split('').map(Number);
  const lines = [];
  let cur = 0;
  let started = false;
  let qStr = '';
  for (const dg of digits) {
    cur = cur * 10 + dg;
    const q = Math.floor(cur / y);
    if (!started && q === 0) {
      if (qStr === '' && cur < y && cur !== x) {
        lines.push(`${y} doesn't go into ${cur}, so look at one more digit.`);
      }
      continue;
    }
    started = true;
    qStr += q;
    const r = cur - q * y;
    if (q === 0) {
      lines.push(`Bring down the next digit to make ${n(cur)}. ${y} doesn't go into ${n(cur)}, so write 0.`);
      continue;
    }
    lines.push(`${m(`${n(cur)} ${D} ${y} = ${q}`)}, because ${m(`${q} ${T} ${y} = ${n(q * y)}`)}. ${r ? `Left over: ${m(`${n(cur)} ${MINUS} ${n(q * y)} = ${r}`)}.` : 'Nothing left over.'}`);
    cur = r;
  }
  if (lines.length > 8) return [lines[0], lines[1], `<span class="note">… keep going the same way, one digit at a time …</span>`, lines[lines.length - 1]];
  return lines;
}

export function divInts(x, y) {
  if (y === 0) throw new MathError("You can't divide by zero. Nobody can, not even a computer!");
  const q = new Q(x, y);
  const ax = Math.abs(x), ay = Math.abs(y);
  const whole = Math.floor(ax / ay);
  const rem = ax % ay;
  const lines = [];
  if ((x < 0) !== (y < 0) && x !== 0) lines.push('One number is negative, so the answer is negative.');
  else if (x < 0 && y < 0) lines.push('Negative divided by negative makes a positive.');
  let hint;
  if (ax === 0) {
    lines.push(`Zero divided by anything (except 0) is 0.`);
    return { q, kind: 'int', lines, hint: 'How many groups can you make from nothing?' };
  }
  if (ay === 1) {
    lines.push(`Dividing by 1 leaves the number the same.`);
    hint = 'What happens when you divide by 1?';
  } else if (!rem && ay <= 12 && whole <= 12) {
    lines.push(`Think: ${m(`${ay} ${T} ? = ${ax}`)}. Times table: ${m(`${ay} ${T} ${whole} = ${ax}`)}, so ${m(`${ax} ${D} ${ay} = ${whole}`)}.`);
    hint = `Think: ${ay} times what makes ${ax}? Use your ${ay} times table.`;
  } else if (isPow10(ay) && !rem) {
    const z = String(ay).length - 1;
    lines.push(`Dividing by ${n(ay)} takes ${z === 1 ? 'a zero' : `${z} zeros`} off the end: ${m(`${n(ax)} ${D} ${n(ay)} = ${n(whole)}`)}.`);
    hint = `What happens to a number when you divide it by ${n(ay)}?`;
  } else if (ax < ay) {
    lines.push(`${n(ax)} is smaller than ${n(ay)}, so the answer is less than 1. Write it as a fraction: ${m(`${n(ax)} ${D} ${n(ay)} = ${fracHTML(ax, ay)}`)}.`);
    const g = gcd(ax, ay);
    if (g > 1) lines.push(`Simplify by dividing top and bottom by ${g}: ${m(`${fracHTML(ax, ay)} = ${fracHTML(ax / g, ay / g)}`)}.`);
    hint = 'The first number is smaller, so the answer is a fraction less than 1.';
  } else {
    lines.push(`Use long division, one digit at a time from the left:`);
    lines.push(...longDivision(ax, ay));
    hint = `Use long division: how many ${n(ay)}s fit into the first digits of ${n(ax)}?`;
  }
  if (rem && ax > ay) {
    lines.push(`So ${m(`${n(ax)} ${D} ${n(ay)} = ${n(whole)} R ${n(rem)}`)} (${n(whole)} remainder ${n(rem)}).`);
    lines.push(`The remainder as a fraction: ${m(`${n(whole)}${fracHTML(rem, ay)}`)}${q.isTerminating() ? `, or as a decimal: ${m(numHTML(q.abs(), 'dec'))}` : ''}.`);
  }
  const kind = q.isInt() ? 'int' : q.isTerminating() && q.decimalPlaces() <= 4 ? 'dec' : 'frac';
  return { q, kind, lines, hint, remainder: rem && ax > ay ? { whole, rem } : null };
}

// ---------- fractions ----------

// Turns any number node into top/bottom numbers, explaining the change.
function asFraction(node, otherIsFrac) {
  const r = node.raw;
  if (node.kind === 'mixed' && r) {
    const neg = r.neg ? -1 : 1;
    const top = r.whole * r.d + r.n;
    return { n: neg * top, d: r.d, line: `Change ${m(numNodeHTML(node))} into an improper fraction: ${m(`${r.whole} ${T} ${r.d} + ${r.n} = ${top}`)}, so it's ${m(fracHTML(top, r.d, r.neg))}.` };
  }
  if (r && r.whole === undefined) return { n: (r.neg ? -1 : 1) * r.n, d: r.d };
  const q = node.q;
  if (node.kind === 'dec' && !q.isInt()) {
    const p = q.decimalPlaces();
    const scaled = Math.round(q.n * 10 ** p / q.d);
    const line = `Write the decimal as a fraction: ${m(`${numHTML(q, 'dec')} = ${fracHTML(Math.abs(scaled), 10 ** p, scaled < 0)}`)}${gcd(scaled, 10 ** p) > 1 ? ` ${m(`= ${numHTML(q, 'frac')}`)}` : ''}.`;
    return { n: q.n, d: q.d, line };
  }
  if (q.isInt() && otherIsFrac) return { n: q.n, d: 1, whole: true };
  return { n: q.n, d: q.d };
}

function simplifyLines(top, bottom) {
  const lines = [];
  const g = gcd(top, bottom);
  let t = top / g, b = bottom / g;
  if (b < 0) { t = -t; b = -b; }
  if (g > 1) {
    lines.push(`Simplify: divide the top and bottom by ${g}. ${m(`${fracHTML(Math.abs(top), Math.abs(bottom), top * bottom < 0)} = ${b === 1 ? n(t) : fracHTML(Math.abs(t), b, t < 0)}`)}.`);
  } else if (Math.abs(b) === 1) {
    lines.push(`A bottom of 1 means it's a whole number: ${m(n(t))}.`);
  }
  if (b !== 1 && Math.abs(t) > b) {
    const w = Math.floor(Math.abs(t) / b);
    lines.push(`<span class="note">${b} goes into ${Math.abs(t)} ${w} time${w > 1 ? 's' : ''} with ${Math.abs(t) % b} left, so that's ${m(`${t < 0 ? MINUS : ''}${w}${fracHTML(Math.abs(t) % b, b)}`)} as a mixed number.</span>`);
  }
  return lines;
}

export function fracAddSub(op, A, B) {
  const a = asFraction(A, true);
  const b = asFraction(B, true);
  const lines = [a.line, b.line].filter(Boolean);
  const sym = op === '+' ? '+' : MINUS;
  const word = op === '+' ? 'add' : 'subtract';
  let hint;
  if (a.whole || b.whole) {
    const w = a.whole ? A : B;
    lines.push(`Write ${m(n(w.q.n))} as a fraction: ${m(fracHTML(Math.abs(w.q.n), 1, w.q.n < 0))}.`);
  }
  let top, bottom;
  if (a.d === b.d) {
    bottom = a.d;
    top = op === '+' ? a.n + b.n : a.n - b.n;
    lines.push(`The bottoms (denominators) are the same, so keep the ${bottom} and ${word} the tops: ${m(`${a.n} ${sym} ${b.n < 0 ? `(${b.n})` : b.n} = ${top}`)}.`);
    lines.push(`${m(`${fracHTML(Math.abs(a.n), a.d, a.n < 0)} ${sym} ${fracHTML(Math.abs(b.n), b.d, b.n < 0)} = ${fracHTML(Math.abs(top), bottom, top < 0)}`)}`);
    hint = `The bottoms are the same. Keep the bottom and ${word} the tops.`;
  } else {
    bottom = lcm(a.d, b.d);
    lines.push(`The bottoms are different (${a.d} and ${b.d}). Find the smallest number both go into: ${m(n(bottom))}. That's the common denominator.`);
    const conv = (f) => {
      const k = bottom / f.d;
      if (k === 1) return f.n;
      lines.push(`${m(`${fracHTML(Math.abs(f.n), f.d, f.n < 0)} = ${fracHTML(`${Math.abs(f.n)} ${T} ${k}`, `${f.d} ${T} ${k}`, f.n < 0)} = ${fracHTML(Math.abs(f.n * k), bottom, f.n < 0)}`)}`);
      return f.n * k;
    };
    const na = conv(a);
    const nb = conv(b);
    top = op === '+' ? na + nb : na - nb;
    lines.push(`Now ${word} the tops: ${m(`${fracHTML(Math.abs(na), bottom, na < 0)} ${sym} ${fracHTML(Math.abs(nb), bottom, nb < 0)} = ${fracHTML(Math.abs(top), bottom, top < 0)}`)}.`);
    hint = `The bottoms are different. Find a number that both ${a.d} and ${b.d} go into.`;
  }
  lines.push(...simplifyLines(top, bottom));
  return { q: new Q(top, bottom), kind: 'frac', lines, hint };
}

export function fracMul(A, B) {
  const a = asFraction(A, true);
  const b = asFraction(B, true);
  const lines = [a.line, b.line].filter(Boolean);
  const top = a.n * b.n;
  const bottom = a.d * b.d;
  const fh = (f) => fracHTML(Math.abs(f.n), f.d, f.n < 0);
  if (a.whole || b.whole) {
    const [w, f] = a.whole ? [a, b] : [b, a];
    lines.push(`Multiply the whole number by the top: ${m(`${w.n} ${T} ${f.n} = ${top}`)}. The bottom stays ${f.d}.`);
    lines.push(m(`${a.whole ? n(a.n) : fh(a)} ${T} ${b.whole ? n(b.n) : fh(b)} = ${fracHTML(Math.abs(top), bottom, top < 0)}`));
  } else {
    lines.push(`Multiply the tops: ${m(`${a.n} ${T} ${b.n} = ${top}`)}. Multiply the bottoms: ${m(`${a.d} ${T} ${b.d} = ${bottom}`)}.`);
    lines.push(m(`${fh(a)} ${T} ${fh(b)} = ${fracHTML(Math.abs(top), bottom, top < 0)}`));
  }
  lines.push(...simplifyLines(top, bottom));
  return { q: new Q(top, bottom), kind: 'frac', lines, hint: 'Multiply top times top and bottom times bottom.' };
}

export function fracDiv(A, B) {
  const b = asFraction(B, true);
  if (b.n === 0) throw new MathError("You can't divide by zero. Nobody can, not even a computer!");
  const flipped = { type: 'num', q: new Q(b.d, b.n), kind: 'frac', raw: { n: Math.abs(b.d), d: Math.abs(b.n), neg: b.n < 0 } };
  const shown = b.d === 1 ? n(b.n) : fracHTML(Math.abs(b.n), b.d, b.n < 0);
  const lines = [];
  if (b.line) lines.push(b.line);
  lines.push(`Dividing by a fraction is the same as multiplying by its flip. Keep, change, flip: ${m(`${D} ${shown}`)} becomes ${m(`${T} ${numNodeHTML(flipped)}`)}.`);
  const r = fracMul(A, flipped);
  return { q: r.q, kind: 'frac', lines: [...lines, ...r.lines], hint: 'Keep the first fraction, change ÷ to ×, and flip the second fraction.' };
}

// ---------- decimals ----------

export function decAddSub(op, A, B) {
  const p = Math.max(A.q.decimalPlaces(), B.q.decimalPlaces());
  const sc = (q) => Math.round(q.n * 10 ** p / q.d);
  const x = sc(A.q), y = sc(B.q);
  const r = addSubScaled(op, x, y, p);
  const lines = [`Line up the decimal points. Fill in zeros so both numbers have ${p} decimal place${p > 1 ? 's' : ''}: ${m(withPoint(x, p).replace('-', MINUS))} and ${m(withPoint(y, p).replace('-', MINUS))}.`, ...r.lines.filter((l) => !l.startsWith('Line the numbers up'))];
  return { q: new Q(r.v, 10 ** p), kind: 'dec', lines, hint: 'Line up the decimal points first, then work like whole numbers.' };
}

export function decMul(A, B) {
  const pa = A.q.decimalPlaces(), pb = B.q.decimalPlaces();
  const q = A.q.mul(B.q);
  const pow10 = [A, B].find((x) => x.q.isInt() && isPow10(Math.abs(x.q.n)));
  if (pow10) {
    const other = pow10 === A ? B : A;
    const z = String(Math.abs(pow10.q.n)).length - 1;
    return { q, kind: 'dec', lines: [`Multiplying by ${n(pow10.q.n)} moves the decimal point ${z} place${z > 1 ? 's' : ''} to the right: ${m(`${numHTML(other.q, 'dec')} ${T} ${n(pow10.q.n)} = ${numHTML(q, 'dec')}`)}.`], hint: `What happens to the decimal point when you multiply by ${n(pow10.q.n)}?` };
  }
  const x = Math.round(A.q.n * 10 ** pa / A.q.d);
  const y = Math.round(B.q.n * 10 ** pb / B.q.d);
  const r = mulInts(x, y);
  const lines = [
    `Ignore the decimal points and multiply whole numbers: ${m(`${n(x)} ${T} ${n(y)}`)}.`,
    ...r.lines,
    `Count the decimal places: ${pa} + ${pb} = ${pa + pb}. Put the point back so the answer has ${pa + pb} decimal place${pa + pb === 1 ? '' : 's'}: ${m(withPoint(r.v, pa + pb).replace('-', MINUS))}${q.decimalPlaces() < pa + pb ? ` ${m(`= ${numHTML(q, 'dec')}`)}` : ''}.`,
  ];
  return { q, kind: 'dec', lines, hint: 'Multiply as if there were no decimal points, then count the decimal places.' };
}

export function decDiv(A, B) {
  const q = A.q.div(B.q);
  const kind = q.isTerminating() && q.decimalPlaces() <= 6 ? 'dec' : 'frac';
  if (B.q.isInt() && isPow10(Math.abs(B.q.n))) {
    const z = String(Math.abs(B.q.n)).length - 1;
    return { q, kind, lines: [`Dividing by ${n(B.q.n)} moves the decimal point ${z} place${z > 1 ? 's' : ''} to the left: ${m(`${numHTML(A.q, 'dec')} ${D} ${n(B.q.n)} = ${numHTML(q, 'dec')}`)}.`], hint: `What happens to the decimal point when you divide by ${n(B.q.n)}?` };
  }
  const pb = B.q.decimalPlaces();
  const lines = [];
  let a = A.q, b = B.q;
  if (pb > 0) {
    a = a.mul(Q.int(10 ** pb));
    b = b.mul(Q.int(10 ** pb));
    lines.push(`Make the number you're dividing by a whole number. Move both decimal points ${pb} place${pb > 1 ? 's' : ''} to the right: ${m(`${numHTML(A.q, 'dec')} ${D} ${numHTML(B.q, 'dec')}`)} becomes ${m(`${numHTML(a, 'dec')} ${D} ${n(b.n)}`)}.`);
  }
  if (a.isInt()) {
    const r = divInts(a.n, b.n);
    lines.push(...r.lines.filter((l) => !l.includes(' R ') && !l.startsWith('The remainder')));
    if (!q.isInt()) lines.push(`So the answer is ${m(kind === 'dec' ? numHTML(q, 'dec') : `${numHTML(q, 'frac')} ≈ ${q.toDecimal()}`)}.`);
  } else {
    lines.push(`Divide like whole numbers and keep the decimal point in the same place: ${m(`${numHTML(a, 'dec')} ${D} ${n(b.n)} = ${kind === 'dec' ? numHTML(q, 'dec') : `${numHTML(q, 'frac')} ≈ ${q.toDecimal()}`}`)}.`);
    lines.push(`<span class="note">Check: ${numHTML(q, kind)} ${T} ${n(b.n)} = ${numHTML(a, 'dec')}</span>`);
  }
  return { q, kind, lines, hint: pb ? 'Move the decimal points so you divide by a whole number.' : 'Divide like whole numbers and keep the decimal point in place.' };
}

// ---------- powers and percents ----------

export function power(A, B) {
  if (!B.q.isInt()) throw new MathError('I can only do whole-number powers, like 2^3.');
  const k = B.q.n;
  if (Math.abs(k) > 60) throw new MathError('That power is too big for me.');
  const q = A.q.pow(k);
  const base = numNodeHTML(A);
  const baseP = A.q.isInt() && A.q.n >= 0 ? base : `(${base})`;
  const lines = [];
  if (k === 0) lines.push(`Any number to the power of 0 is 1.`);
  else if (k === 1) lines.push(`To the power of 1 means just the number itself.`);
  else if (k < 0) lines.push(`A negative power means 1 divided by the positive power: ${m(`${baseP}<sup>${MINUS}${-k}</sup> = 1 ${D} ${baseP}<sup>${-k}</sup> = ${numHTML(q, A.kind === 'dec' ? 'dec' : 'frac')}`)}.`);
  else if (k <= 6) lines.push(`${m(`${baseP}<sup>${k}</sup>`)} means ${m(base)} multiplied by itself ${k === 2 ? '(squared)' : k === 3 ? '(cubed)' : `${k} times`}: ${m(`${Array(k).fill(baseP).join(` ${T} `)} = ${numHTML(q, A.kind)}`)}.`);
  else lines.push(`Multiply ${base} by itself ${k} times: ${m(numHTML(q, A.kind))}.`);
  return { q, kind: A.kind === 'mixed' ? 'frac' : A.kind, lines, hint: k > 1 ? `The little ${k} means multiply ${A.q.isInt() ? A.q.n : 'the number'} by itself ${k} times.` : 'What does that power mean?' };
}

export function percent(A) {
  const q = A.q.div(Q.int(100));
  const kind = q.isTerminating() ? 'dec' : 'frac';
  return { q, kind, lines: [`Percent means "out of 100", so ${m(`${numNodeHTML(A)}% = ${numNodeHTML(A)} ${D} 100 = ${numHTML(q, kind)}`)}.`], hint: 'Percent means "out of 100".' };
}

export function percentOf(P, N) {
  const p = P.q;
  const whole = N.q;
  const q = p.mul(whole).div(Q.int(100));
  const kind = q.isTerminating() && q.decimalPlaces() <= 4 ? (q.isInt() ? 'int' : 'dec') : 'frac';
  const ph = numNodeHTML(P), nh = numNodeHTML(N), rh = numHTML(q, kind);
  const lines = [];
  const tricks = { 50: ['50% is half', 2], 25: ['25% is a quarter', 4], 10: ['10% is one tenth', 10], 20: ['20% is one fifth', 5], 100: ['100% is the whole thing', 1] };
  const tr = p.isInt() && tricks[p.n];
  if (tr) {
    lines.push(`Shortcut: ${tr[0]}, so divide by ${tr[1]}: ${m(`${nh} ${D} ${tr[1]} = ${rh}`)}.`);
  } else {
    lines.push(`"${ph}% of ${nh}" means ${m(`${ph} ${D} 100 ${T} ${nh}`)}.`);
    lines.push(`Multiply first: ${m(`${ph} ${T} ${nh} = ${numHTML(p.mul(whole), p.mul(whole).isInt() ? 'int' : 'dec')}`)}. Then divide by 100: ${m(rh)}.`);
    if (p.isInt() && p.n % 10 === 0 && p.n < 100) lines.push(`<span class="note">Another way: 10% of ${nh} is ${numHTML(whole.div(Q.int(10)), 'dec')}, and ${p.n}% is ${p.n / 10} of those: ${numHTML(whole.div(Q.int(10)), 'dec')} ${T} ${p.n / 10} = ${rh}</span>`);
  }
  return { q, kind, lines, hint: tr ? `${tr[0]}. What's ${tr[1] === 1 ? 'the whole' : `${nh} ÷ ${tr[1]}`}?` : `"Of" means multiply. Find ${ph} ÷ 100 × ${nh}.` };
}
