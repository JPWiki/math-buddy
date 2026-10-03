// Reads a word problem the way kids are taught to: find the question, find the
// numbers, spot the clue words, then write the math sentence.
// Returns null when it can't tell what to do, so the app can say so honestly.

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const WORD_VALUE = Object.fromEntries([...SMALL.map((w, i) => [w, i]), ...TENS.map((w, i) => [w, 20 + i * 10])]);

const FRACTION_WORDS = [
  [/\b(?:one|a) half\b|\bhalf\b/, '1/2'],
  [/\b(?:one|a) third\b/, '1/3'],
  [/\btwo thirds\b/, '2/3'],
  [/\b(?:one|a) quarter\b|\b(?:one|a) fourth\b/, '1/4'],
  [/\bthree quarters\b|\bthree fourths\b/, '3/4'],
];

const NUMBER_WORD = `(?:${TENS.join('|')})(?:[- ](?:${SMALL.slice(1, 10).join('|')}))?|${SMALL.join('|')}`;

// Finds every number with where it sits in the text, so it can be highlighted.
export function findNumbers(text) {
  const low = text.toLowerCase();
  const found = [];
  const taken = (s, e) => found.some((f) => s < f.end && e > f.start);
  const add = (start, end, value, extra = {}) => { if (!taken(start, end)) found.push({ start, end, value, ...extra }); };

  for (const [re, value] of FRACTION_WORDS) {
    const g = new RegExp(re.source, 'g');
    let mt;
    while ((mt = g.exec(low))) add(mt.index, mt.index + mt[0].length, value, { fraction: true });
  }
  let mt;
  const digits = /\$?\d[\d,]*(?:\.\d+)?(?:\/\d+)?\s?%?/g;
  while ((mt = digits.exec(low))) {
    const raw = mt[0].trim();
    const value = raw.replace(/[$,\s]/g, '');
    add(mt.index, mt.index + raw.length, value, { money: raw.startsWith('$'), percent: raw.endsWith('%'), fraction: raw.includes('/') });
  }
  const dozen = /\b(?:a|one) dozen\b/g;
  while ((mt = dozen.exec(low))) add(mt.index, mt.index + mt[0].length, '12');
  const words = new RegExp(`\\b(${NUMBER_WORD})(?: (hundred|thousand))?\\b`, 'g');
  while ((mt = words.exec(low))) {
    const w = mt[1];
    const before = low.slice(Math.max(0, mt.index - 12), mt.index);
    const after = low.slice(mt.index + mt[0].length, mt.index + mt[0].length + 10);
    // "each one", "one of them", "no one" aren't numbers.
    if (w === 'one' && (/(each|every|no|any|some|which|this|that|the) $/.test(before) || /^ (of|another|more time)/.test(after))) continue;
    const parts = w.split(/[- ]/);
    let v = parts.reduce((s, p) => s + WORD_VALUE[p], 0);
    if (mt[2] === 'hundred') v *= 100;
    if (mt[2] === 'thousand') v *= 1000;
    add(mt.index, mt.index + mt[0].length, String(v));
  }
  return found.sort((a, b) => a.start - b.start);
}

// ---------- clue words ----------

const MEANING = {
  '+': 'means putting together, so <b>add (+)</b>',
  '-': 'means taking away, so <b>subtract (−)</b>',
  cmp: 'means comparing, so <b>subtract</b> the smaller number from the bigger one',
  '*': 'means equal groups, so <b>multiply (×)</b>',
  '/': 'means sharing into equal groups, so <b>divide (÷)</b>',
  pct: 'means a percent of a number: <b>% of</b>',
  frac: 'a fraction <b>of</b> a number means multiply',
  off: 'means take that percent away from the price',
  addpct: 'means add that percent on top',
  spend: 'means spending money, so <b>subtract (\u2212)</b> it from what you had',
  part: 'means the part over the whole: <b>part \u00f7 whole</b>, written as a fraction',
};

const Q_COMPARE = /how (?:many|much) (?:more|fewer|less|longer|shorter|taller|older|younger|heavier|lighter|farther|further|bigger|smaller)\b|\bdifference\b|how much (?:taller|longer|older|bigger|heavier|shorter|younger)\b/;
const Q_DIVIDE = /\b(?:in|on|for|to|into) each\b|how (?:long|much|many|big|heavy|wide|far) (?:is|are|was|will|does|did|would) (?:each|one)\b|\beach (?:\w+ )?(?:gets?|got|receives?|have|has|need)\b|how many (?:does|do|did|will|would|can|could|should) each\b|\bper\b|\bhow many (?:groups|bags|boxes|teams|rows|piles|packs|tables|cars|vans|buses|plates|baskets|shelves|trips)\b|\b(?:can|could) (?:\w+ )?(?:buy|make|fill|get|plant)\b|\baverage\b|how many each\b/;
const Q_LEFT = /\bleft\b|\bremain|\bchange\b|\bstill\b|\bempty\b|\bunused\b/;
const Q_TOTAL = /\bin all\b|\baltogether\b|\btotal\b|\bcombined\b|\btogether\b|\bsum\b|\bboth\b|\bspend\b|\bspent\b|\bcost\b|\bpay\b/;
const DIVIDE = /\bshare[sd]?\b[^.?!]*\b(?:equally|evenly)\b|\bshare[sd]?\b|\bequally\b|\bevenly\b|\bsplit\b|\bdivided?\b|\bequal (?:groups|parts|teams|rows|piles|bags|boxes|shares)\b|\b(?:into|in) (?:groups|teams|piles|bags|boxes|rows|packs) of\b|\bcut into\b|\bequal (?:pieces|parts|lengths|amounts)\b/;
const MULTIPLY = /\beach\b|\bevery\b|\bper\b|\btimes as (?:many|much)\b|\btimes\b|\btwice\b|\bdoubles?\b|\bdoubled\b|\btriples?d?\b|\b(?:rows|groups|packs|boxes|bags|sets|stacks|teams|bundles|cartons|crates|packets|jars|trays|shelves) of\b|\ba (?:day|week|month|year|night|hour|minute|page)\b/;
const SUBTRACT = /\bgave\b|\bgives?\b|\bgiving\b|\baway\b|\bspent\b|\bspends?\b|\blost\b|\bloses?\b|\bate\b|\beats?\b|\bsold\b|\bsells?\b|\btook\b|\btakes?\b|\bused\b|\buses\b|\bbroke\b|\bpopped\b|\bfell\b|\bgets? off\b|\bgot off\b|\bleft\b|\bremain|\bfewer\b|\bless\b|\bminus\b|\bdonated?\b|\bthrew\b|\bthrows?\b|\bpaid\b|\bpays?\b|\bdropped\b|\bmissing\b|\bmelted\b|\bflew\b|\bran away\b/;
const ADD = /\bmore\b|\bin all\b|\baltogether\b|\btotal\b|\bsum\b|\bcombined\b|\btogether\b|\badded\b|\badds?\b|\bplus\b|\bbought\b|\bbuys?\b|\bgets?\b|\bgot\b|\bfound\b|\bfinds?\b|\breceived?\b|\bjoined?\b|\banother\b|\bboth\b|\bgets? on\b|\bgot on\b|\bearned?\b|\bsaved\b|\bpicked\b|\bcollected\b|\bmade\b|\bgrew\b|\bgrows?\b|\bgained\b|\bincreased?\b|\bscored\b/;
const BUY = /\bbought\b|\bbuys?\b|\bspent\b|\bspends?\b|\bpaid\b|\bpays?\b|\bcosts?\b/;

function firstMatch(re, s, offset = 0) {
  const mt = re.exec(s);
  return mt ? { start: offset + mt.index, end: offset + mt.index + mt[0].length, text: mt[0] } : null;
}

function splitQuestion(low) {
  const sentences = [];
  const re = /[^.?!]+[.?!]?/g;
  let mt;
  while ((mt = re.exec(low))) {
    if (mt[0].trim()) sentences.push({ text: mt[0], start: mt.index });
  }
  let qi = sentences.findIndex((s) => s.text.includes('?'));
  if (qi < 0) qi = sentences.findIndex((s) => /^\s*(how|what|find|calculate|work out)\b/.test(s.text));
  if (qi < 0) qi = sentences.length - 1;
  return { sentences, q: sentences[qi], qi };
}

// The thing being counted, so the answer can say "4 cookies" instead of just "4".
const NOT_UNITS = new Set(['more', 'fewer', 'less', 'times', 'of', 'are', 'is', 'were', 'was', 'did', 'does', 'do', 'can', 'could', 'will', 'would', 'in', 'each', 'altogether', 'total', 'left', 'does', 'should', 'had', 'has', 'have', 'there', 'they', 'he', 'she', 'it', 'we', 'you', 'i', 'longer', 'taller', 'older']);
function findUnit(q, low, nums) {
  const mt = /how many ((?:\w+ ){0,3}\w+)/.exec(q);
  if (mt) {
    const words = mt[1].split(' ');
    while (words.length && /^(more|fewer|less)$/.test(words[0])) words.shift();
    const phrase = [];
    for (const w of words) {
      if (NOT_UNITS.has(w) || phrase.length === 2) break;
      phrase.push(w);
      // "students walk" stops at the plural noun; "juice boxes" keeps going.
      if (/s$/.test(w)) break;
    }
    if (phrase.length) return phrase.join(' ');
  }
  const after = low.slice(nums[0].end).match(/^\s+([a-z]+)/);
  if (after && !NOT_UNITS.has(after[1]) && !/^(and|or|each|per|more|of|for|on|in|at)$/.test(after[1])) return after[1];
  return null;
}

const val = (nm) => (nm.percent ? nm.value.replace('%', '') : nm.value);
const asNum = (nm) => Number(eval1(val(nm)));
function eval1(s) {
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return a / b; }
  return Number(s);
}

// For two numbers, decide what to do and in which order.
function twoNumbers(low, q, nums, clues) {
  const [a, b] = nums;
  const big = asNum(a) >= asNum(b) ? a : b;
  const small = big === a ? b : a;
  const pct = nums.find((x) => x.percent);
  const qOff = q.start;

  if (pct) {
    const other = nums.find((x) => x !== pct);
    const p = `${val(pct)}%`;
    const off = firstMatch(/\boff\b/, low) || firstMatch(/\bdiscount\b|\bsale\b/, low);
    const plus = firstMatch(/\btax\b|\btip\b|\bincrease[sd]?\b|\bgrew\b|\braised?\b/, low);
    if (off && /cost|pay|price|now|sale/.test(q.text)) { clues.push({ ...off, op: 'off' }); return `${val(other)} - ${p} of ${val(other)}`; }
    if (plus && /cost|pay|total|now|in all/.test(q.text)) { clues.push({ ...plus, op: 'addpct' }); return `${val(other)} + ${p} of ${val(other)}`; }
    clues.push({ start: pct.start, end: pct.end, text: '%', op: 'pct' });
    return `${p} of ${val(other)}`;
  }
  const frac = nums.find((x) => x.fraction);
  if (frac && !nums.every((x) => x.fraction)) {
    const gap = low.slice(frac.end).match(/^\s*/)[0].length;
    const ofm = firstMatch(/^of\b/, low.slice(frac.end + gap), frac.end + gap);
    if (ofm) {
      clues.push({ ...ofm, op: 'frac' });
      const other = nums.find((x) => x !== frac);
      return `${val(frac)} of ${val(other)}`;
    }
  }

  let c;
  if ((c = firstMatch(/what fraction|what part/, q.text, qOff))) {
    const left = firstMatch(Q_LEFT, q.text, qOff) || firstMatch(/\bnot\b/, q.text, qOff);
    clues.push({ ...c, op: 'part' });
    if (left) { clues.push({ ...left, op: '-' }); return `(${val(big)} - ${val(small)}) / ${val(big)}`; }
    return `${val(small)} / ${val(big)}`;
  }
  if ((c = firstMatch(Q_COMPARE, q.text, qOff))) { clues.push({ ...c, op: 'cmp' }); return `${val(big)} - ${val(small)}`; }
  if ((c = firstMatch(Q_DIVIDE, q.text, qOff) || firstMatch(DIVIDE, low))) {
    // "per" in a "how much in total" question is multiplying, not sharing.
    if (!(/\bper\b/.test(c.text) && Q_TOTAL.test(q.text))) {
      clues.push({ ...c, op: '/' });
      const body = firstMatch(DIVIDE, low);
      if (body && body.start !== c.start) clues.unshift({ ...body, op: '/' });
      return `${val(big)} / ${val(small)}`;
    }
  }
  if ((c = firstMatch(MULTIPLY, low))) { clues.push({ ...c, op: '*' }); return `${val(a)} * ${val(b)}`; }
  if ((c = firstMatch(Q_LEFT, q.text, qOff) || firstMatch(SUBTRACT, low))) { clues.push({ ...c, op: '-' }); return `${val(big)} - ${val(small)}`; }
  if ((c = firstMatch(ADD, low) || firstMatch(Q_TOTAL, q.text, qOff))) { clues.push({ ...c, op: '+' }); return `${val(a)} + ${val(b)}`; }
  return null;
}

// Three or four numbers: work through the story in order, one part at a time.
function manyNumbers(low, q, nums, clues, sentences) {
  const parts = [];
  for (const s of sentences) {
    let pos = s.start;
    const chunks = s.text.split(/(,\s*then\b|\bthen\b|,\s*and\b|\band then\b|;|,)/);
    for (const ch of chunks) {
      if (ch && !/^(,\s*then|then|,\s*and|and then|;|,)$/.test(ch.trim())) parts.push({ text: ch, start: pos });
      pos += ch ? ch.length : 0;
    }
  }
  const inPart = (p) => nums.filter((x) => x.start >= p.start && x.end <= p.start + p.text.length);
  const qWantsLeft = Q_LEFT.test(q.text);
  const qWantsTotal = Q_TOTAL.test(q.text);
  let expr = null;
  let used = 0;
  for (const p of parts) {
    const ns = inPart(p);
    if (!ns.length) continue;
    let term;
    if (ns.length === 2) {
      let c;
      if ((c = firstMatch(MULTIPLY, p.text, p.start))) { clues.push({ ...c, op: '*' }); term = `${val(ns[0])} * ${val(ns[1])}`; }
      else if ((c = firstMatch(DIVIDE, p.text, p.start))) { clues.push({ ...c, op: '/' }); term = `${val(ns[0])} / ${val(ns[1])}`; }
      else return null;
    } else if (ns.length === 1) {
      term = val(ns[0]);
    } else {
      return null;
    }
    used += ns.length;
    if (expr === null) { expr = term; continue; }
    let op = null;
    let c;
    const buy = firstMatch(BUY, p.text, p.start);
    let clueOp = null;
    if (buy && (qWantsLeft || qWantsTotal)) { op = qWantsLeft ? '-' : '+'; c = buy; clueOp = qWantsLeft ? 'spend' : '+'; }
    else if (ns.length === 1 && (c = firstMatch(MULTIPLY, p.text, p.start))) op = '*';
    else if (ns.length === 1 && (c = firstMatch(DIVIDE, p.text, p.start))) op = '/';
    else if ((c = firstMatch(SUBTRACT, p.text, p.start))) op = '-';
    else if ((c = firstMatch(ADD, p.text, p.start))) op = '+';
    else if (qWantsTotal) { op = '+'; c = firstMatch(Q_TOTAL, q.text, q.start); }
    else if (qWantsLeft) { op = '-'; c = firstMatch(Q_LEFT, q.text, q.start); }
    if (!op) return null;
    if (c) clues.push({ ...c, op: clueOp || op });
    const needsParens = (op === '*' || op === '/') && /[+-]/.test(expr);
    expr = `${needsParens ? `(${expr})` : expr} ${op} ${term.includes(' ') && (op === '-' || op === '/') && !/\*|\//.test(term) ? `(${term})` : term}`;
  }
  return used === nums.length ? expr : null;
}

function highlight(text, nums, clues) {
  const marks = [
    ...nums.map((x) => ({ start: x.start, end: x.end, open: '<mark>', close: '</mark>' })),
    ...clues.filter((c) => c.text !== '%').map((c) => ({ start: c.start, end: c.end, open: '<u class="clue">', close: '</u>' })),
  ].sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  for (const mk of marks) {
    if (mk.start < pos) continue;
    out += esc(text.slice(pos, mk.start)) + mk.open + esc(text.slice(mk.start, mk.end)) + mk.close;
    pos = mk.end;
  }
  return out + esc(text.slice(pos));
}

export function looksLikeWords(text) {
  return (String(text).match(/[a-z]{3,}/gi) || []).length >= 3;
}

export function readWordProblem(text) {
  const src = String(text).replace(/\s+/g, ' ').trim();
  const low = src.toLowerCase();
  const nums = findNumbers(src);
  if (nums.length < 2 || nums.length > 5) return null;
  const { sentences, q } = splitQuestion(low);
  if (!q) return null;
  const clues = [];
  const expr = nums.length === 2 ? twoNumbers(low, q, nums, clues) : manyNumbers(low, q, nums, clues, sentences);
  if (!expr) return null;

  const money = nums.some((x) => x.money) && !/how many/.test(q.text) && /how much|money|cost|spend|spent|pay|price|\$|change|left|save/.test(q.text);
  const unit = money ? null : findUnit(q.text, low, nums);
  const seen = new Set();
  const clueList = clues.filter((c) => {
    const key = `${c.text}|${c.op}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const numberList = nums.map((x) => {
    const tail = src.slice(x.end).match(/^\s+([A-Za-z]+(?:\s[a-z]+)?)/);
    return src.slice(x.start, x.end) + (tail && !/^(and|or|each|per|of|for|on|in|at|to|is|are|the|a)\b/i.test(tail[1]) ? ` ${tail[1].split(' ')[0]}` : '');
  });
  return {
    expr,
    asFraction: /what fraction|what part/.test(q.text),
    money,
    unit,
    question: src.slice(q.start, q.start + q.text.length).trim(),
    numbers: numberList,
    clues: clueList.map((c) => ({ text: src.slice(c.start, c.end), meaning: MEANING[c.op] })),
    html: highlight(src, nums, clueList),
    plainHTML: highlight(src, [], []),
  };
}
