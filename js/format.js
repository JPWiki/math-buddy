// Turning numbers and expression trees into text and HTML.

const MINUS = '−';

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function group(n) {
  const s = String(Math.abs(n));
  const g = Math.abs(n) >= 1000 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s;
  return (n < 0 ? MINUS : '') + g;
}

function groupDecimal(str) {
  const neg = str.startsWith('-');
  const [w, f] = (neg ? str.slice(1) : str).split('.');
  return (neg ? MINUS : '') + group(Number(w)) + (f !== undefined ? '.' + f : '');
}

export function fracHTML(n, d, neg = false) {
  const g = (v) => (typeof v === 'string' ? v : group(v));
  return `${neg ? MINUS : ''}<span class="frac"><span>${g(n)}</span><span>${g(d)}</span></span>`;
}

// How a number is written depends on how it arrived: 0.5 stays a decimal, 1/2 stays a fraction.
export function numHTML(q, kind = 'frac') {
  if (q.isInt()) return group(q.n);
  if (kind === 'dec' && q.isTerminating()) return groupDecimal(q.toDecimal(8));
  if (kind === 'mixed') {
    const m = q.mixedParts();
    if (m.whole) return `${m.neg ? MINUS : ''}${group(m.whole)}${fracHTML(m.n, m.d)}`;
  }
  return fracHTML(Math.abs(q.n), q.d, q.n < 0);
}

export function numText(q, kind = 'frac') {
  if (q.isInt()) return group(q.n);
  if (kind === 'dec' && q.isTerminating()) return groupDecimal(q.toDecimal(8));
  if (kind === 'mixed') {
    const m = q.mixedParts();
    if (m.whole) return `${m.neg ? MINUS : ''}${m.whole} ${m.n}/${m.d}`;
  }
  return (q.n < 0 ? MINUS : '') + `${Math.abs(q.n)}/${q.d}`;
}

// Every way a 10-year-old might want to see an answer.
export function answerForms(q) {
  const forms = [];
  if (q.isInt()) return [{ label: '', html: group(q.n), text: group(q.n) }];
  forms.push({ label: 'fraction', html: numHTML(q, 'frac'), text: numText(q, 'frac') });
  if (Math.abs(q.n) > q.d) forms.push({ label: 'mixed number', html: numHTML(q, 'mixed'), text: numText(q, 'mixed') });
  if (q.isTerminating() && q.decimalPlaces() <= 8) {
    forms.push({ label: 'decimal', html: numHTML(q, 'dec'), text: numText(q, 'dec') });
  } else {
    forms.push({ label: 'decimal', html: '≈ ' + q.toDecimal(), text: '≈ ' + q.toDecimal() });
  }
  return forms;
}

// Fractions are shown the way they were typed (2/4 stays 2/4 until we simplify it).
function rawHTML(raw) {
  const sign = raw.neg ? MINUS : '';
  if (raw.whole !== undefined) return `${sign}${group(raw.whole)}${fracHTML(raw.n, raw.d)}`;
  return fracHTML(raw.n, raw.d, raw.neg);
}

function rawText(raw) {
  const sign = raw.neg ? MINUS : '';
  if (raw.whole !== undefined) return `${sign}${raw.whole} ${raw.n}/${raw.d}`;
  return `${sign}${raw.n}/${raw.d}`;
}

export function numNodeHTML(node) {
  return node.raw ? rawHTML(node.raw) : numHTML(node.q, node.kind);
}

export function numNodeText(node) {
  return node.raw ? rawText(node.raw) : numText(node.q, node.kind);
}

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, neg: 3, '^': 4, pct: 5 };
const SYM = { '+': '+', '-': MINUS, '*': '×', '/': '÷' };

function prec(node) {
  if (node.type === 'bin') return PREC[node.op];
  if (node.type === 'neg') return PREC.neg;
  if (node.type === 'pct') return PREC.pct;
  return 9;
}

function isNegNum(node) {
  return node.type === 'num' && (node.q.n < 0 || !!(node.raw && node.raw.neg));
}

function needsParen(child, parent, side) {
  if (child.paren && child.type !== 'num' && child.type !== 'var') return true;
  if (parent.type === 'pct') return prec(child) < 9 || isNegNum(child);
  if (parent.type === 'neg') return prec(child) < PREC.neg || isNegNum(child);
  if (isNegNum(child) && (side === 'r' || parent.op === '^')) return true;
  const cp = prec(child);
  const pp = PREC[parent.op];
  if (parent.op === '^') return side === 'l' ? cp <= pp : false;
  if (cp < pp) return true;
  return cp === pp && side === 'r' && (parent.op === '-' || parent.op === '/');
}

// Prints an expression tree. `hl` is the node to highlight (the bit we are working on).
export function exprHTML(node, hl = null, varName = 'x') {
  const wrap = (child, side, parent) => {
    const inner = exprHTML(child, hl, varName);
    return needsParen(child, parent, side) ? `(${inner})` : inner;
  };
  let out;
  switch (node.type) {
    case 'num': out = numNodeHTML(node); break;
    case 'var': out = `<i class="var">${esc(varName)}</i>`; break;
    case 'neg': out = MINUS + wrap(node.a, 'r', node); break;
    case 'pct': out = wrap(node.a, 'l', node) + '%'; break;
    case 'bin':
      if (node.op === '^') {
        out = `${wrap(node.l, 'l', node)}<sup>${exprHTML(node.r, hl, varName)}</sup>`;
      } else if (node.implicit) {
        out = wrap(node.l, 'l', node) + wrap(node.r, 'r', node);
      } else {
        out = `${wrap(node.l, 'l', node)} ${SYM[node.op]} ${wrap(node.r, 'r', node)}`;
      }
      break;
  }
  return node === hl ? `<mark>${out}</mark>` : out;
}

export function exprText(node, varName = 'x') {
  const wrap = (child, side, parent) => {
    const inner = exprText(child, varName);
    return needsParen(child, parent, side) || (parent.op === '^' && side === 'r' && prec(child) < 9) ? `(${inner})` : inner;
  };
  switch (node.type) {
    case 'num': return numNodeText(node);
    case 'var': return varName;
    case 'neg': return MINUS + wrap(node.a, 'r', node);
    case 'pct': return wrap(node.a, 'l', node) + '%';
    case 'bin':
      if (node.op === '^') return `${wrap(node.l, 'l', node)}^${wrap(node.r, 'r', node)}`;
      if (node.implicit) return wrap(node.l, 'l', node) + wrap(node.r, 'r', node);
      return `${wrap(node.l, 'l', node)} ${SYM[node.op]} ${wrap(node.r, 'r', node)}`;
  }
  return '';
}

export { MINUS };
