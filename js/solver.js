// Works a problem through one step at a time and records every step.

import { Q, MathError, gcd } from './rational.js';
import { parseProblem } from './parser.js';
import { exprHTML, exprText, numHTML, numText, numNodeHTML, fracHTML, group, answerForms, MINUS } from './format.js';
import * as X from './explain.js';
import { readWordProblem, looksLikeWords } from './words.js';

const OP_TITLES = { '+': 'Add', '-': 'Subtract', '*': 'Multiply', '/': 'Divide', '^': 'Work out the power' };
const T = '×';
const D = '÷';

const isNum = (nd) => nd && nd.type === 'num';
const isFracKind = (k) => k === 'frac' || k === 'mixed';

function combineKind(a, b) {
  if (isFracKind(a.kind) || isFracKind(b.kind)) return 'frac';
  if (a.kind === 'dec' || b.kind === 'dec') return 'dec';
  return 'int';
}

function isPercentOf(nd) {
  return nd.type === 'bin' && nd.op === '*' && nd.l.type === 'pct' && isNum(nd.l.a) && isNum(nd.r);
}

function reducible(nd) {
  if (isPercentOf(nd)) return true;
  if (nd.type === 'bin') return isNum(nd.l) && isNum(nd.r);
  if (nd.type === 'neg' || nd.type === 'pct') return isNum(nd.a);
  return false;
}

// Order of operations falls out of the tree: the first node we can work out,
// reading left to right and innermost first, is the one to do next.
function findNext(nd, ancestors = []) {
  if (isPercentOf(nd)) return { node: nd, ancestors };
  for (const k of ['l', 'r', 'a']) {
    if (nd[k]) {
      const found = findNext(nd[k], [...ancestors, nd]);
      if (found) return found;
    }
  }
  return reducible(nd) ? { node: nd, ancestors } : null;
}

function replace(nd, target, repl) {
  if (nd === target) return repl;
  const out = { ...nd };
  for (const k of ['l', 'r', 'a']) if (nd[k]) out[k] = replace(nd[k], target, repl);
  return out;
}

function countOps(nd) {
  if (!nd || nd.type === 'num' || nd.type === 'var') return 0;
  if (isPercentOf(nd)) return 1;
  return 1 + countOps(nd.l) + countOps(nd.r) + countOps(nd.a);
}

function hasOp(nd, ops, skip) {
  if (!nd || nd === skip) return false;
  if (nd.type === 'bin' && ops.includes(nd.op)) return true;
  return hasOp(nd.l, ops, skip) || hasOp(nd.r, ops, skip) || hasOp(nd.a, ops, skip);
}

function orderReason(tree, node, ancestors) {
  if (countOps(tree) < 2) return '';
  const inBrackets = node.paren || ancestors.slice(1).some((a) => a.paren) || (ancestors[0] && ancestors[0].paren && ancestors.length > 1);
  if (inBrackets && node !== tree) return 'Brackets first';
  if (node.type === 'bin' && node.op === '^') return 'Powers before × ÷ + −';
  if (node.type === 'pct' || isPercentOf(node)) return 'Percents first';
  if (node.type === 'bin' && (node.op === '*' || node.op === '/') && hasOp(tree, ['+', '-'], node)) return '× and ÷ before + and −';
  return 'Left to right';
}

function compute(nd) {
  if (isPercentOf(nd)) return { title: 'Find the percent', ...X.percentOf(nd.l.a, nd.r) };
  if (nd.type === 'pct') return { title: 'Change the percent to a number', ...X.percent(nd.a) };
  if (nd.type === 'neg') {
    const q = nd.a.q.neg();
    return { title: 'Take the opposite', q, kind: nd.a.kind, lines: [`The opposite of ${numNodeHTML(nd.a)} is ${numHTML(q, nd.a.kind)}.`], hint: 'A minus sign in front means the opposite.' };
  }
  const { op, l, r } = nd;
  const title = OP_TITLES[op];
  if (op === '^') return { title, ...X.power(l, r) };
  const kind = combineKind(l, r);
  if (op === '+' || op === '-') {
    if (kind === 'frac') return { title, ...X.fracAddSub(op, l, r) };
    if (kind === 'dec') return { title, ...X.decAddSub(op, l, r) };
    const res = X.addSubScaled(op, l.q.n, r.q.n);
    const small = Math.abs(l.q.n) < 10 && Math.abs(r.q.n) < 10;
    const hint = op === '+'
      ? (small ? 'Start at the bigger number and count on.' : 'Line the numbers up by place value. Add the ones first.')
      : (small ? 'Start at the first number and count back.' : 'Line the numbers up. Start with the ones, and borrow if the top digit is smaller.');
    return { title, q: Q.int(res.v), kind: 'int', lines: res.lines, hint };
  }
  if (op === '*') {
    if (kind === 'frac') return { title, ...X.fracMul(l, r) };
    if (kind === 'dec') return { title, ...X.decMul(l, r) };
    const res = X.mulInts(l.q.n, r.q.n);
    return { title, q: Q.int(res.v), kind: 'int', lines: res.lines, hint: res.hint };
  }
  if (kind === 'frac') return { title, ...X.fracDiv(l, r) };
  if (kind === 'dec') return { title, ...X.decDiv(l, r) };
  return { title, ...X.divInts(l.q.n, r.q.n) };
}

function evaluateSteps(tree, varName) {
  const steps = [];
  let cur = tree;
  let guard = 0;
  while (cur.type !== 'num') {
    if (guard++ > 60) throw new MathError('That problem has too many steps for me.');
    const found = findNext(cur);
    if (!found) throw new MathError("I couldn't work that one out.");
    const { node, ancestors } = found;
    const c = compute(node);
    const resNode = { type: 'num', q: c.q, kind: c.kind, fresh: true };
    const next = replace(cur, node, resNode);
    steps.push({
      title: c.title,
      reason: orderReason(cur, node, ancestors),
      beforeHTML: exprHTML(cur, node, varName),
      lines: c.lines,
      afterHTML: exprHTML(next, resNode, varName),
      hint: c.hint,
      remainder: c.remainder,
    });
    cur = next;
  }
  return { steps, result: cur };
}

function simplifyOnly(node) {
  const r = node.raw;
  if (!r) return [];
  const top = r.whole !== undefined ? r.whole * r.d + r.n : r.n;
  if (r.whole === undefined && node.q.d === r.d) return [];
  const lines = [];
  if (r.whole !== undefined) {
    lines.push(`Change ${numNodeHTML(node)} into an improper fraction: ${r.whole} ${T} ${r.d} + ${r.n} = ${top}, so it's ${fracHTML(top, r.d, r.neg)}.`);
  }
  const g = top / Math.abs(node.q.n || 1);
  if (r.whole === undefined) lines.push(`Divide the top and bottom by ${g}: ${fracHTML(r.n, r.d, r.neg)} = ${numHTML(node.q, 'frac')}.`);
  return [{ title: r.whole !== undefined ? 'Rewrite the mixed number' : 'Simplify the fraction', reason: '', beforeHTML: numNodeHTML(node), lines, afterHTML: `<mark>${numHTML(node.q, 'frac')}</mark>`, hint: r.whole !== undefined ? 'Multiply the whole number by the bottom, then add the top.' : `Find a number that divides both ${r.n} and ${r.d}.` }];
}

function firstHint(tree, steps) {
  const parts = [];
  if (countOps(tree) >= 2) parts.push('There is more than one operation here. Remember the order: brackets, then powers, then × and ÷ from left to right, then + and − from left to right. Which part comes first?');
  if (steps[0] && steps[0].hint) parts.push(steps[0].hint);
  return parts.join(' ');
}

// ---------- equations ----------

class NotLinear extends MathError {}

function toLinear(nd) {
  switch (nd.type) {
    case 'num': return { a: Q.int(0), b: nd.q };
    case 'var': return { a: Q.int(1), b: Q.int(0) };
    case 'neg': { const s = toLinear(nd.a); return { a: s.a.neg(), b: s.b.neg() }; }
    case 'pct': { const s = toLinear(nd.a); const h = Q.int(100); return { a: s.a.div(h), b: s.b.div(h) }; }
    case 'bin': {
      const L = toLinear(nd.l);
      const R = toLinear(nd.r);
      switch (nd.op) {
        case '+': return { a: L.a.add(R.a), b: L.b.add(R.b) };
        case '-': return { a: L.a.sub(R.a), b: L.b.sub(R.b) };
        case '*':
          if (!L.a.isZero() && !R.a.isZero()) throw new NotLinear('This has the unknown multiplied by itself (a squared equation). I can solve equations like 3x + 5 = 20 for now.');
          return { a: L.a.mul(R.b).add(R.a.mul(L.b)), b: L.b.mul(R.b) };
        case '/':
          if (!R.a.isZero()) throw new NotLinear("The unknown is on the bottom of a fraction. I can't solve that kind yet.");
          return { a: L.a.div(R.b), b: L.b.div(R.b) };
        case '^': {
          if (!R.a.isZero() || !R.b.isInt()) throw new NotLinear('I can only do whole-number powers.');
          const k = R.b.n;
          if (L.a.isZero()) return { a: Q.int(0), b: L.b.pow(k) };
          if (k === 1) return L;
          if (k === 0) return { a: Q.int(0), b: Q.int(1) };
          throw new NotLinear('This has a squared (or higher) unknown. I can solve equations like 3x + 5 = 20 for now.');
        }
      }
    }
  }
  throw new MathError("I couldn't read that equation.");
}

function qHTML(q) {
  return numHTML(q, q.isTerminating() && q.decimalPlaces() <= 2 && !q.isInt() ? 'dec' : 'frac');
}

function coefHTML(a, v) {
  const vh = `<i class="var">${v}</i>`;
  if (a.eq(Q.int(1))) return vh;
  if (a.eq(Q.int(-1))) return MINUS + vh;
  if (Math.abs(a.n) === 1) return `${a.n < 0 ? MINUS : ''}${vh} ${D} ${group(a.d)}`;
  if (v === '?') return `${qHTML(a)} ${T} ${vh}`;
  return qHTML(a) + vh;
}

function linHTML({ a, b }, v) {
  if (a.isZero()) return qHTML(b);
  let s = coefHTML(a, v);
  if (!b.isZero()) s += b.sign() > 0 ? ` + ${qHTML(b)}` : ` ${MINUS} ${qHTML(b.neg())}`;
  return s;
}

const eqHTML = (l, r) => `${l} = ${r}`;

function substitute(nd, value) {
  if (nd.type === 'var') return { type: 'num', q: value, kind: value.isInt() ? 'int' : 'frac' };
  const out = { ...nd, implicit: false };
  for (const k of ['l', 'r', 'a']) if (nd[k]) out[k] = substitute(nd[k], value);
  return out;
}

function evalQ(nd) {
  let cur = nd;
  while (cur.type !== 'num') {
    const { node } = findNext(cur);
    const c = compute(node);
    cur = replace(cur, node, { type: 'num', q: c.q, kind: c.kind });
  }
  return cur.q;
}

function findDistributions(nd, out = []) {
  if (nd.type === 'bin' && nd.op === '*') {
    const paren = [nd.l, nd.r].find((c) => c.paren && c.type === 'bin' && (c.op === '+' || c.op === '-'));
    if (paren) {
      try { out.push(nd); } catch { /* skip */ }
    }
  }
  for (const k of ['l', 'r', 'a']) if (nd[k]) findDistributions(nd[k], out);
  return out;
}

function countVars(nd) {
  if (!nd) return 0;
  if (nd.type === 'var') return 1;
  return countVars(nd.l) + countVars(nd.r) + countVars(nd.a);
}

// A side like "3x + 5" or "x ÷ 4" can be worked on as it is. Brackets, repeated
// unknowns, or sums still to work out get a tidy-up step first.
function needsTidy(nd) {
  if (countVars(nd) > 1) return true;
  if (!countVars(nd)) return countOps(nd) > 0;
  const walk = (x) => {
    if (x.type === 'num' || x.type === 'var') return false;
    if (x.paren || x.type === 'pct' || x.type === 'neg' || (x.type === 'bin' && x.op === '^')) return true;
    if (x.type === 'bin' && !countVars(x.l) && !countVars(x.r)) return true;
    return walk(x.l) || walk(x.r);
  };
  return walk(nd);
}

function solveEquation(left, right, v) {
  const L = toLinear(left);
  const R = toLinear(right);
  const steps = [];
  const original = eqHTML(exprHTML(left, null, v), exprHTML(right, null, v));
  let cur = { L, R };
  let untouched = true;
  const curHTML = () => (untouched ? original : eqHTML(linHTML(cur.L, v), linHTML(cur.R, v)));

  if (needsTidy(left) || needsTidy(right)) {
    const lines = [];
    for (const nd of [...findDistributions(left), ...findDistributions(right)]) {
      lines.push(`Multiply out the brackets: ${exprHTML(nd, null, v)} = ${linHTML(toLinear(nd), v)}.`);
    }
    if (countVars(left) > 1 || countVars(right) > 1) lines.push(`Combine the ${v} terms together, and the plain numbers together.`);
    if (!lines.length) lines.push('Work out each side as far as it goes.');
    untouched = false;
    steps.push({ title: 'Tidy up each side', reason: '', beforeHTML: original, lines, afterHTML: `<mark>${curHTML()}</mark>`, hint: 'First make each side simpler.' });
  }

  const vh = `<i class="var">${v}</i>`;
  if (cur.L.a.eq(cur.R.a)) {
    const same = cur.L.b.eq(cur.R.b);
    return {
      steps,
      special: same ? 'all' : 'none',
      message: same ? `Both sides are always equal, so <b>every number</b> works for ${vh}.` : `The ${vh} parts are the same on both sides but the numbers aren't, so <b>no number</b> works. There is no solution.`,
    };
  }

  // Get all the unknowns on the left.
  if (!cur.R.a.isZero()) {
    const t = cur.R.a;
    const term = coefHTML(t.abs(), v);
    const sub = t.sign() > 0;
    const before = curHTML();
    cur = { L: { a: cur.L.a.sub(t), b: cur.L.b }, R: { a: Q.int(0), b: cur.R.b } };
    untouched = false;
    steps.push({
      title: `${sub ? 'Subtract' : 'Add'} ${term.replace(/<[^>]+>/g, '')} ${sub ? 'from' : 'to'} both sides`,
      reason: `Get the ${v}s on one side`,
      beforeHTML: before,
      lines: [`There are ${v}s on both sides. ${sub ? 'Take away' : 'Add'} ${term} on both sides so all the ${v}s are on the left.`, `${linHTML(cur.L, v)} = ${qHTML(cur.R.b)}`],
      afterHTML: `<mark>${curHTML()}</mark>`,
      hint: `There are ${v}s on both sides. Try ${sub ? 'taking away' : 'adding'} ${term.replace(/<[^>]+>/g, '')} on both sides.`,
    });
  }

  if (!cur.L.b.isZero()) {
    const b = cur.L.b;
    const sub = b.sign() > 0;
    const bh = qHTML(b.abs());
    const before = curHTML();
    const newR = cur.R.b.sub(b);
    steps.push({
      title: `${sub ? 'Subtract' : 'Add'} ${qHTML(b.abs()).replace(/<[^>]+>/g, (t) => (t === '</span><span>' ? '/' : ''))} ${sub ? 'from' : 'to'} both sides`,
      reason: `Get ${v} by itself`,
      beforeHTML: before,
      lines: [
        `${sub ? `+ ${bh}` : `${MINUS} ${bh}`} is stuck to the ${v} side. Undo it by ${sub ? 'taking away' : 'adding'} ${bh} on <b>both</b> sides (whatever you do to one side, do to the other).`,
        `${linHTML(cur.L, v)} ${sub ? MINUS : '+'} ${bh} = ${qHTML(cur.R.b)} ${sub ? MINUS : '+'} ${bh}`,
      ],
      afterHTML: '',
      hint: `What is being ${sub ? 'added to' : 'taken away from'} the ${v} side? Do the opposite to both sides.`,
    });
    untouched = false;
    cur = { L: { a: cur.L.a, b: Q.int(0) }, R: { a: Q.int(0), b: newR } };
    steps[steps.length - 1].afterHTML = `<mark>${curHTML()}</mark>`;
  }

  const a = cur.L.a;
  const value = cur.R.b.div(a);
  if (!a.eq(Q.int(1))) {
    const before = curHTML();
    let title, lines, hint;
    if (a.eq(Q.int(-1))) {
      title = 'Flip the signs';
      lines = [`${MINUS}${vh} means the opposite of ${vh}. Change the sign on both sides.`];
      hint = `${MINUS}${v} is the opposite of ${v}. What if you flip the sign on both sides?`;
    } else if (a.isInt()) {
      title = `Divide both sides by ${group(a.n)}`;
      lines = [`${v === '?' ? '' : `${coefHTML(a, v)} means ${group(a.n)} ${T} ${vh}, so `}${vh} is being multiplied by ${group(a.n)}. Undo it by dividing both sides by ${group(a.n)}.`, `${vh} = ${qHTML(cur.R.b)} ${D} ${a.n < 0 ? `(${group(a.n)})` : group(a.n)} = ${qHTML(value)}`];
      if (!value.isInt()) lines.push(`<span class="note">The answer isn't a whole number, so leave it as a fraction${value.isTerminating() ? ` or decimal: ${numHTML(value, 'dec')}` : ''}.</span>`);
      hint = `${v} is being multiplied by ${a.n}. What's the opposite of multiplying?`;
    } else {
      const flip = a.inv();
      title = a.n === 1 || a.n === -1 ? `Multiply both sides by ${group(flip.n)}` : `Multiply both sides by ${numText(flip)}`;
      lines = [a.n === 1 ? `${vh} is being divided by ${a.d}. Undo it by multiplying both sides by ${a.d}.` : `${vh} is being multiplied by ${qHTML(a)}. Undo it by multiplying both sides by the flip, ${qHTML(flip)}.`, `${vh} = ${qHTML(cur.R.b)} ${T} ${qHTML(flip)} = ${qHTML(value)}`];
      hint = a.n === 1 ? `${v} is being divided by ${a.d}. What's the opposite of dividing?` : `Multiply both sides by the flip of ${numText(a)}.`;
    }
    steps.push({ title, reason: `Get ${v} by itself`, beforeHTML: before, lines, afterHTML: `<mark>${vh} = ${qHTML(value)}</mark>`, hint });
  }

  // Put the answer back in to check it.
  const lv = evalQ(substitute(left, value));
  const rv = evalQ(substitute(right, value));
  const sub = (nd) => (countVars(nd) ? `${exprHTML(substitute(nd, value), null, v)} = ` : '');
  steps.push({
    title: 'Check the answer',
    reason: '',
    beforeHTML: `${vh} = ${qHTML(value)}`,
    lines: [`Put ${qHTML(value)} back in for ${vh}:`, `Left side: ${sub(left)}${qHTML(lv)}`, `Right side: ${sub(right)}${qHTML(rv)}`, lv.eq(rv) ? 'Both sides match. ✔' : 'They should match. Something went wrong.'],
    afterHTML: '',
    hint: '',
    check: true,
  });

  return { steps, value };
}

// ---------- public ----------

const WORD_HELP = "I couldn't work out this word problem. Find the question and the numbers, then decide: put together (+), take away (\u2212), equal groups (\u00d7) or share equally (\u00f7)? Type it as a number problem, like 24 \u00f7 6.";

export function solve(input) {
  let parsed;
  try {
    parsed = parseProblem(input);
  } catch (e) {
    if (!(e instanceof MathError) || !looksLikeWords(input)) throw e;
    const w = readWordProblem(input);
    if (!w) throw new MathError(WORD_HELP);
    return solveWords(w);
  }
  return solveParsed(parsed);
}

function moneyText(q, currency = '$') {
  const neg = q.sign() < 0;
  const v = Math.abs(q.valueOf());
  return `${neg ? MINUS : ''}${currency}${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

function solveWords(w) {
  const res = solveParsed(parseProblem(w.expr));
  const mathHTML = res.problemHTML;
  const lines = [
    `<b>The question:</b> ${w.question.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}`,
    `<b>The numbers:</b> ${w.numbers.map((x) => `<mark>${x.replace(/[&<>]/g, '')}</mark>`).join(', ')}`,
    ...w.clues.map((c) => `<b>Clue:</b> <u class="clue">${c.text}</u> ${c.meaning}.`),
    `So the math sentence is <span class="m">${mathHTML}</span>.`,
  ];
  res.steps.unshift({
    title: 'Turn the words into math',
    reason: '',
    beforeHTML: `<div class="word-text">${w.html}</div>`,
    lines,
    afterHTML: `<mark>${mathHTML}</mark>`,
    hint: '',
  });
  // The problem itself is shown plain: spotting the numbers and clue words is the skill.
  // The highlighted version is in the first step.
  res.problemHTML = `<div class="word-text">${w.plainHTML}</div>`;
  res.problemText = w.question;
  res.word = w;
  res.hint = `Find the question first. Then find the numbers and the clue words. Do you need to put together (+), take away (\u2212), make equal groups (\u00d7) or share equally (\u00f7)?${w.clues[0] ? ` Look at the words "${w.clues[0].text}".` : ''}`;
  const q = res.answer.q;
  if (q && w.asFraction) {
    res.answer.html = numHTML(q, 'frac');
  } else if (q && w.money) {
    res.answer.html = moneyText(q, w.currency || '$');
    res.answer.forms = [];
  } else if (q && w.unit) {
    res.answer.html += ` <span class="unit">${w.unit}</span>`;
  }
  return res;
}

function solveParsed(parsed) {
  if (parsed.kind === 'expr') {
    const tree = parsed.tree;
    let { steps, result } = evaluateSteps(tree);
    if (!steps.length) steps = simplifyOnly(tree);
    const forms = answerForms(result.q);
    const main = numHTML(result.q, result.kind === 'dec' && result.q.isTerminating() ? 'dec' : result.q.isInt() ? 'int' : 'frac');
    const last = steps[steps.length - 1];
    if (steps.length === 1 && last.remainder) {
      forms.push({ label: 'with remainder', html: `${group(last.remainder.whole)} R ${group(last.remainder.rem)}`, text: `${last.remainder.whole} R ${last.remainder.rem}` });
    }
    return {
      type: 'expr',
      problemHTML: exprHTML(tree),
      problemText: exprText(tree),
      steps,
      answer: { q: result.q, html: main, forms },
      hint: firstHint(tree, steps) || 'This is already worked out. Can you see why?',
    };
  }

  const { left, right, varName } = parsed;
  if (!varName) {
    // "2 + 3 = 5": check whether a statement is true.
    const ls = evaluateSteps(left);
    const rs = evaluateSteps(right);
    const lq = ls.result.q, rq = rs.result.q;
    const tag = (arr, side) => arr.map((s) => ({ ...s, title: `${side} side: ${s.title.toLowerCase()}` }));
    return {
      type: 'check',
      problemHTML: eqHTML(exprHTML(left), exprHTML(right)),
      problemText: `${exprText(left)} = ${exprText(right)}`,
      steps: [...tag(ls.steps, 'Left'), ...tag(rs.steps, 'Right')],
      answer: { q: lq, html: lq.eq(rq) ? 'True ✔' : 'Not true ✘', truth: lq.eq(rq), forms: [{ label: '', html: `${qHTML(lq)} ${lq.eq(rq) ? '=' : '≠'} ${qHTML(rq)}`, text: '' }] },
      hint: 'Work out each side on its own, then see if they match.',
    };
  }

  const v = varName;
  const res = solveEquation(left, right, v);
  const vh = `<i class="var">${v}</i>`;
  const out = {
    type: 'eq',
    varName: v,
    problemHTML: eqHTML(exprHTML(left, null, v), exprHTML(right, null, v)),
    problemText: `${exprText(left, v)} = ${exprText(right, v)}`,
    steps: res.steps,
    hint: v === '?'
      ? 'What number goes in the box? Work backwards: undo each operation with its opposite.'
      : `Get ${v} by itself. Undo each thing that's done to ${v} with the opposite operation, on both sides. ${res.steps[0] && res.steps[0].hint ? res.steps[0].hint : ''}`.trim(),
  };
  if (res.special) {
    out.answer = { special: res.special, html: res.message, forms: [] };
  } else {
    const forms = answerForms(res.value).map((f) => ({ ...f, html: `${vh} = ${f.html}` }));
    out.answer = { q: res.value, html: `${vh} = ${qHTML(res.value)}`, forms };
  }
  return out;
}

// Reads a kid's typed answer: "3/4", "0.75", "2 1/2", "x = 5", "7 R 3".
// An answer must be one number: 12, -5, 0.75, 3/4, 2 1/2 (optionally "x = ...", "₹14" or
// "14 cookies"). A calculation like "7/10 + 2/10" is not an answer, so it isn't accepted.
const ONE_NUMBER = /^-?(\d[\d,]*(\.\d+)?|\.\d+|\d+\/\d+|\d+ \d+\/\d+)$/;

export function readAnswer(text) {
  let s = String(text).trim()
    .replace(/[\u2212\u2013]/g, '-')
    .replace(/^[a-z?]\s*=\s*/i, '')
    .replace(/^[$\u20b9]\s*/, '')
    .replace(/^(-?[\d.,/ ]*\d)\s+[a-z][a-z ]*$/i, '$1')
    .replace(/\s+/g, ' ');
  const rem = s.match(/^(-?\d+)\s*(?:r|rem|remainder)\s*(\d+)$/i);
  if (rem) return { remainder: { whole: Number(rem[1]), rem: Number(rem[2]) } };
  if (!ONE_NUMBER.test(s)) throw new MathError('Type just the answer as one number, like 12, 0.5 or 9/10.');
  const parsed = parseProblem(s);
  return { q: evalQ(parsed.tree) };
}

// A right answer written as a fraction must be in simplest form, the way school expects:
// 18/20 should be 9/10, 12/4 should be 3, 2 4/3 should be 3 1/3. Improper fractions like 7/4
// and mixed numbers like 1 3/4 are both fine.
function notSimplest(text) {
  const s = String(text).trim().replace(/[\u2212\u2013]/g, '-').replace(/^[a-z?]\s*=\s*/i, '').replace(/^[$\u20b9]\s*/, '');
  const mt = s.match(/^-?(?:(\d+)\s+)?(\d+)\/(\d+)/);
  if (!mt) return null;
  const whole = mt[1] !== undefined ? Number(mt[1]) : null;
  const n = Number(mt[2]), d = Number(mt[3]);
  if (n % d === 0) return `That's the right value, but write it as a whole number: ${n / d + (whole || 0)}.`;
  const g = gcd(n, d);
  if (g > 1) return `That's the right value, but write it in simplest form: divide the top and bottom by ${g}.`;
  if (whole !== null && n > d) return "That's the right value, but the fraction part should be less than 1. Move the extra wholes into the whole number.";
  return null;
}

export function checkAnswer(text, expected, remainderInfo = null) {
  let got;
  try { got = readAnswer(text); } catch (e) { return { ok: false, error: e.message }; }
  if (got.remainder) {
    if (remainderInfo) return { ok: got.remainder.whole === remainderInfo.whole && got.remainder.rem === remainderInfo.rem };
    return { ok: false, error: 'Write the answer as a number, like 4 or 3/4.' };
  }
  if (got.q.eq(expected)) {
    const hint = notSimplest(text);
    return hint ? { ok: false, simplify: true, error: hint } : { ok: true };
  }
  if (!expected.isTerminating() && Math.abs(got.q.valueOf() - expected.valueOf()) < 0.01) return { ok: true, close: true };
  return { ok: false };
}
