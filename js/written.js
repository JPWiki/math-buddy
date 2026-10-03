// The written methods from school, laid out on a grid like on paper:
// long multiplication (with carries and partial-product rows) and long division
// (with the bracket, subtraction rows and brought-down digits).

import { group } from './format.js';

const T = '×';
const MINUS = '−';
const m = (html) => `<span class="m">${html}</span>`;
const n = (x) => group(x);

function grid(ncols) {
  const rows = [];
  return {
    row(cls = '') {
      const r = { cls, cells: Array.from({ length: ncols }, () => ({ t: '', cls: [] })) };
      rows.push(r);
      return r;
    },
    html(tableCls) {
      const body = rows.map((r) => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.cells.map((c) => `<td${c.cls.length ? ` class="${c.cls.join(' ')}"` : ''}>${c.t}</td>`).join('')}</tr>`).join('');
      return `<div class="col-scroll"><table class="${tableCls}" aria-hidden="true">${body}</table></div>`;
    },
  };
}

// Puts the characters of `str` into `row` so the last one lands in column `end`.
function putRight(row, str, end, cls) {
  const chars = String(str).split('');
  chars.forEach((ch, k) => {
    const c = row.cells[end - (chars.length - 1 - k)];
    if (!c) return;
    c.t = ch;
    if (cls) c.cls.push(...[].concat(cls(k, chars.length) || []));
  });
}

// ---------- long multiplication ----------

function rowSentence(top, d) {
  const digits = String(top).split('').reverse().map(Number);
  const parts = [];
  let carry = 0;
  const carries = {};
  digits.forEach((dg, i) => {
    const prod = d * dg;
    const total = prod + carry;
    const last = i === digits.length - 1;
    let s = `${d} ${T} ${dg} = ${prod}`;
    if (carry) s += ` + ${carry} carried = ${total}`;
    if (!last && total >= 10) {
      s += `, write ${total % 10} carry ${Math.floor(total / 10)}`;
      carries[i + 1] = Math.floor(total / 10);
    } else {
      s += `, write ${total}`;
    }
    carry = last ? 0 : Math.floor(total / 10);
    parts.push(m(s));
  });
  return { text: `<ul class="digit-steps">${parts.map((x) => `<li>${x}</li>`).join('')}</ul>`, carries };
}

const PLACE_WORD = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands'];

// top × bottom for whole numbers, at least one of them 13 or more.
export function longMultiply(x, y) {
  const [top, bottom] = String(x).length >= String(y).length ? [x, y] : [y, x];
  const p = top * bottom;
  const bDigits = String(bottom).split('').reverse().map(Number);
  const partials = bDigits.map((d, k) => ({ d, k, v: top * d * 10 ** k }));
  const used = partials.filter((pt) => pt.d !== 0);
  const single = bDigits.length === 1;
  const width = Math.max(String(p).length, String(top).length, String(bottom).length + 1, ...partials.map((pt) => String(pt.v).length + 1)) + 1;
  const g = grid(width);
  const end = width - 1;
  const lines = [];

  if (single) {
    const rs = rowSentence(top, bottom);
    if (Object.keys(rs.carries).length) {
      const cr = g.row('carry');
      for (const [i, v] of Object.entries(rs.carries)) {
        const c = cr.cells[end - Number(i)];
        if (c) c.t = `<small>${v}</small>`;
      }
    }
    putRight(g.row(), top, end);
    const br = g.row('op');
    putRight(br, bottom, end);
    br.cells[end - String(bottom).length].t = T;
    putRight(g.row('total'), p, end);
    lines.push(`Write ${n(top)} on top and ${bottom} underneath, lined up on the right. Multiply each digit of ${n(top)} by ${bottom}, starting with the ones:`);
    lines.push(rs.text);
    lines.push(`So ${m(`${n(top)} ${T} ${bottom} = ${n(p)}`)}.`);
    return { p, html: g.html('col-work long'), lines };
  }

  putRight(g.row(), top, end);
  const br = g.row('op');
  putRight(br, bottom, end);
  br.cells[end - String(bottom).length].t = T;
  lines.push(`Write ${n(top)} on top and ${n(bottom)} underneath, lined up on the right. Multiply ${n(top)} by each digit of ${n(bottom)}, one row at a time:`);
  used.forEach((pt, idx) => {
    const isLast = idx === used.length - 1;
    const r = g.row(isLast ? 'op' : '');
    // Placeholder zeros are shown lighter so kids can see why they're there.
    putRight(r, pt.v, end, (k, len) => (k >= len - pt.k ? 'ph' : null));
    if (isLast && used.length > 1) r.cells[end - String(pt.v).length].t = '+';
    const rs = rowSentence(top, pt.d);
    const place = PLACE_WORD[pt.k] || `place ${pt.k + 1}`;
    const zeros = pt.k ? ` First write ${pt.k === 1 ? 'a 0' : `${pt.k} zeros`} on the right, because this digit is in the ${place} (it's really ${n(pt.d * 10 ** pt.k)}). Then` : '';
    lines.push(`<b>Row ${idx + 1}</b>, the ${place} digit ${pt.d}:${zeros ? `${zeros} multiply:` : ''}${rs.text}Row ${idx + 1} is ${m(n(pt.v))}.`);
  });
  partials.filter((pt) => pt.d === 0).forEach((pt) => {
    lines.push(`<span class="note">The ${PLACE_WORD[pt.k] || 'next'} digit is 0, so that row would be all zeros. Skip it.</span>`);
  });
  putRight(g.row('total'), p, end);
  if (used.length > 1) lines.push(`Add the rows: ${m(`${used.map((pt) => n(pt.v)).join(' + ')} = ${n(p)}`)}.`);
  return { p, html: g.html('col-work long'), lines };
}

// ---------- long division ----------

// dividend: a non-negative number as text ("750", "56.35"); y: whole number divisor.
// extend: how many extra 0s we may bring down after the decimal point to finish.
export function longDivide(dividend, y, { extend = 0 } = {}) {
  let [ip, fp] = String(dividend).split('.');
  ip = ip.replace(/^0+(?=\d)/, '');
  let digits = (ip + (fp || '')).split('').map(Number);
  let pointAfter = fp !== undefined ? ip.length : null;
  const originalLen = digits.length;

  const steps = [];
  let cur = 0;
  let started = false;
  let skipped = 0;
  let extra = 0;
  for (let i = 0; ; i++) {
    if (i >= digits.length) {
      if (cur === 0 || extra >= extend) break;
      if (pointAfter === null) pointAfter = digits.length;
      digits.push(0);
      extra++;
    }
    cur = cur * 10 + digits[i];
    const q = Math.floor(cur / y);
    const lastIntDigit = pointAfter === null ? digits.length - 1 : pointAfter - 1;
    if (!started && q === 0 && i < lastIntDigit) { skipped++; continue; }
    started = true;
    const prod = q * y;
    steps.push({ i, cur, q, prod, rem: cur - prod });
    cur -= prod;
  }
  const rem = cur;

  const hasPoint = pointAfter !== null;
  const col = (i) => 2 + i + (hasPoint && i >= pointAfter ? 1 : 0);
  const ncols = 2 + digits.length + (hasPoint ? 1 : 0) + 1;
  const g = grid(ncols);

  // Answer on top.
  const qr = g.row('quot');
  steps.forEach((s) => { qr.cells[col(s.i)].t = String(s.q); });
  if (hasPoint) qr.cells[2 + pointAfter].t = '.';
  if (rem && !extend) qr.cells[ncols - 1].t = `<span class="r">R${rem}</span>`;

  // Divisor and dividend under the bracket.
  const dr = g.row('dividend');
  dr.cells[0].t = String(y);
  dr.cells[0].cls.push('dv');
  digits.forEach((dg, i) => {
    const c = dr.cells[col(i)];
    c.t = String(dg);
    if (i >= originalLen) c.cls.push('ph');
  });
  if (hasPoint) dr.cells[2 + pointAfter].t = '.';
  for (let c = 2; c < ncols - 1; c++) dr.cells[c].cls.push('bar');
  dr.cells[2].cls.push('bar-l');

  // Subtract, then bring down, one step at a time.
  steps.forEach((s, k) => {
    const pr = g.row();
    const ps = String(s.prod);
    putRight(pr, ps, col(s.i));
    pr.cells[col(s.i - ps.length + 1) - 1].t = MINUS;
    for (let j = s.i - ps.length + 1; j <= s.i; j++) if (j >= 0) pr.cells[col(j)].cls.push('u');
    const next = steps[k + 1];
    const vr = g.row();
    if (next) {
      putRight(vr, String(next.cur), col(next.i), (kk, len) => (kk === len - 1 ? 'down' : null));
    } else {
      putRight(vr, String(rem), col(s.i), () => 'left');
    }
  });

  // The same steps in words.
  const lines = [];
  const first = steps[0];
  if (skipped) lines.push(`${y} doesn't go into ${digits.slice(0, skipped).join('')}, so start with ${m(n(first.cur))}.`);
  steps.forEach((s, k) => {
    const next = steps[k + 1];
    let line = `How many ${y}s in ${m(n(s.cur))}? ${s.q === 0 ? `None, so write 0.` : `${m(`${s.q}`)}, because ${m(`${s.q} ${T} ${y} = ${n(s.prod)}`)}. Subtract: ${m(`${n(s.cur)} ${MINUS} ${n(s.prod)} = ${s.rem}`)}.`}`;
    if (next) {
      const d = digits[next.i];
      const crossing = hasPoint && next.i === pointAfter;
      line += next.i >= originalLen ? ` Bring down a 0${crossing ? ' (after the decimal point)' : ''}.` : ` Bring down the ${d}.`;
      if (crossing) line += ` <span class="note">We've reached the decimal point, so put a point in the answer right above it.</span>`;
    }
    lines.push(line);
  });

  let quot = steps.map((s) => s.q).join('');
  if (hasPoint) {
    const intDigits = steps.filter((s) => s.i < pointAfter).length;
    quot = (quot.slice(0, intDigits) || '0') + '.' + quot.slice(intDigits);
    quot = quot.replace(/\.?0+$/, '') || '0';
  }
  if (lines.length > 10) lines.splice(3, lines.length - 5, '<span class="note">… keep going the same way, one digit at a time …</span>');
  return { html: g.html('col-work ldiv'), lines, quot, rem, finished: rem === 0, extraZeros: extra };
}
