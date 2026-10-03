// Reads what a kid types ("3/4 + 1 1/2", "25% of 80", "3x + 5 = 20", "? x 6 = 42")
// and turns it into a tree the solver can work through.

import { Q, MathError } from './rational.js';

const UNKNOWN_MARKS = /\?|_+|□|☐|▢|⬜/g;
const HAS_UNKNOWN_MARK = /\?|_|□|☐|▢|⬜/;

export function preprocess(raw) {
  let s = String(raw).trim();
  if (!s) throw new MathError('Type a math problem first, like 12 + 7.');
  s = s
    .replace(/[×·∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[[{]/g, '(')
    .replace(/[\]}]/g, ')')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\*\*/g, '^');
  s = s.replace(/^\s*(what\s+is|what's|calculate|solve|find)\s*/i, '');
  s = s
    .replace(/\bof\b/gi, '*')
    .replace(/\btimes\b/gi, '*')
    .replace(/\bmultiplied by\b/gi, '*')
    .replace(/\bdivided by\b/gi, '/')
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\bequals\b/gi, '=');
  s = s.replace(/\s*=\s*$/, '');
  if (!s.includes('=')) s = s.replace(/\?\s*$/, '');

  const isEq = s.includes('=');
  let varName = null;
  if (isEq) {
    if (HAS_UNKNOWN_MARK.test(s)) {
      varName = '?';
      s = s.replace(UNKNOWN_MARKS, ' u ');
    }
    if ((s.match(/=/g) || []).length > 1) throw new MathError('Use only one = sign.');
  } else {
    // Without an = sign, x means "times".
    s = s.replace(/x/gi, '*');
  }
  return { src: s.toLowerCase(), isEq, varName };
}

function tokenize(src) {
  const toks = [];
  let i = 0;
  const isDigit = (c) => c >= '0' && c <= '9';
  const readNumber = (j) => {
    let k = j;
    while (k < src.length && (isDigit(src[k]) || src[k] === '.')) k++;
    return src.slice(j, k);
  };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      const text = readNumber(i);
      if ((text.match(/\./g) || []).length > 1) throw new MathError(`"${text}" has two decimal points.`);
      i += text.length;
      // "3/4" written with no spaces is a fraction, "3 / 4" is division.
      if (src[i] === '/' && isDigit(src[i + 1]) && !text.includes('.')) {
        const den = readNumber(i + 1);
        if (!den.includes('.')) {
          i += 1 + den.length;
          const prev = toks[toks.length - 1];
          // "2 3/4" is a mixed number.
          if (prev && prev.t === 'num' && prev.kind === 'int' && !prev.joined) {
            const whole = prev.q;
            prev.q = whole.add(new Q(Number(text), Number(den)));
            prev.kind = 'mixed';
            prev.text = `${prev.text} ${text}/${den}`;
            prev.joined = true;
            prev.raw = { whole: whole.n, n: Number(text), d: Number(den) };
            continue;
          }
          toks.push({ t: 'num', q: new Q(Number(text), Number(den)), kind: 'frac', text: `${text}/${den}`, raw: { n: Number(text), d: Number(den) } });
          continue;
        }
      }
      const kind = text.includes('.') ? 'dec' : 'int';
      toks.push({ t: 'num', q: kind === 'dec' ? Q.fromDecimal(text) : Q.int(Number(text)), kind, text });
      continue;
    }

    if (/[a-z]/.test(c)) {
      let k = i;
      while (k < src.length && /[a-z]/.test(src[k])) k++;
      const word = src.slice(i, k);
      if (word.length > 1) {
        throw new MathError(`I don't understand "${word}" yet. Try typing just the numbers and signs, like 12 + 7.`);
      }
      toks.push({ t: 'var', v: word });
      i = k;
      continue;
    }

    if ('+-*/^'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === '%') { toks.push({ t: 'pct' }); i++; continue; }
    if (c === '=') { toks.push({ t: 'eq' }); i++; continue; }
    throw new MathError(`I don't know what "${c}" means here.`);
  }

  // 3x, 2(x + 1), (2)(3) all mean multiply.
  const out = [];
  for (const tk of toks) {
    const prev = out[out.length - 1];
    if (prev) {
      const prevEnds = prev.t === 'num' || prev.t === 'var' || prev.t === 'rp' || prev.t === 'pct';
      const starts = tk.t === 'num' || tk.t === 'var' || tk.t === 'lp';
      if (prevEnds && starts) {
        if (prev.t === 'num' && tk.t === 'num') throw new MathError(`There's a sign missing between ${prev.text} and ${tk.text}.`);
        out.push({ t: 'op', v: '*', implicit: true });
      }
    }
    out.push(tk);
  }
  return out;
}

class Parser {
  constructor(toks) { this.toks = toks; this.i = 0; }
  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }
  isOp(v) { const t = this.peek(); return t && t.t === 'op' && t.v === v; }

  expr() {
    let node = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().v;
      node = { type: 'bin', op, l: node, r: this.term() };
    }
    return node;
  }

  term() {
    let node = this.unary();
    while (this.isOp('*') || this.isOp('/')) {
      const tk = this.next();
      node = { type: 'bin', op: tk.v, l: node, r: this.unary(), implicit: !!tk.implicit };
    }
    return node;
  }

  unary() {
    if (this.isOp('-')) {
      this.next();
      const a = this.unary();
      if (a.type === 'num' && !a.paren) return { ...a, q: a.q.neg(), raw: a.raw ? { ...a.raw, neg: !a.raw.neg } : undefined };
      return { type: 'neg', a };
    }
    if (this.isOp('+')) { this.next(); return this.unary(); }
    return this.power();
  }

  power() {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.next();
      return { type: 'bin', op: '^', l: base, r: this.unary() };
    }
    return base;
  }

  postfix() {
    let node = this.primary();
    while (this.peek() && this.peek().t === 'pct') {
      this.next();
      node = { type: 'pct', a: node };
    }
    return node;
  }

  primary() {
    const tk = this.next();
    if (!tk) throw new MathError('The problem stops too early. Is a number missing at the end?');
    if (tk.t === 'num') return tk.raw ? { type: 'num', q: tk.q, kind: tk.kind, raw: tk.raw } : { type: 'num', q: tk.q, kind: tk.kind };
    if (tk.t === 'var') return { type: 'var', name: tk.v };
    if (tk.t === 'lp') {
      const inner = this.expr();
      const close = this.next();
      if (!close || close.t !== 'rp') throw new MathError('A bracket was opened but never closed.');
      if (inner.type !== 'num' && inner.type !== 'var') inner.paren = true;
      return inner;
    }
    if (tk.t === 'rp') throw new MathError('There is a ) without a matching (.');
    if (tk.t === 'op') throw new MathError(`There's a number missing before "${tk.v === '*' ? '×' : tk.v === '/' ? '÷' : tk.v}".`);
    throw new MathError("I couldn't read that problem. Check the signs and numbers.");
  }
}

function parseSide(toks) {
  if (!toks.length) throw new MathError('One side of the = sign is empty.');
  const p = new Parser(toks);
  const node = p.expr();
  if (p.i < toks.length) {
    const tk = toks[p.i];
    throw new MathError(tk.t === 'rp' ? 'There is a ) without a matching (.' : "I couldn't read that problem. Check the signs and numbers.");
  }
  return node;
}

function collectVars(node, set = new Set()) {
  if (node.type === 'var') set.add(node.name);
  for (const k of ['l', 'r', 'a']) if (node[k]) collectVars(node[k], set);
  return set;
}

// Returns { kind: 'expr', tree } or { kind: 'eq', left, right, varName }.
export function parseProblem(raw) {
  const { src, isEq, varName } = preprocess(raw);
  const toks = tokenize(src);
  if (!isEq) {
    const tree = parseSide(toks);
    if (collectVars(tree).size) throw new MathError('Letters only work in equations with an = sign, like 3x + 5 = 20.');
    return { kind: 'expr', tree };
  }
  const at = toks.findIndex((t) => t.t === 'eq');
  const left = parseSide(toks.slice(0, at));
  const right = parseSide(toks.slice(at + 1));
  const vars = new Set([...collectVars(left), ...collectVars(right)]);
  if (vars.size > 1) throw new MathError(`This has ${vars.size} different letters (${[...vars].join(', ')}). I can solve equations with one unknown.`);
  const name = vars.size ? [...vars][0] : null;
  return { kind: 'eq', left, right, varName: name ? (varName || name) : null };
}
