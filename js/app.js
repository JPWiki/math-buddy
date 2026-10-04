import { solve, checkAnswer } from './solver.js';
import { MathError } from './rational.js';
import { TOPICS, LEVELS, LEVEL_STARS, GRADES, gradeLabel, gradeAges, makeRound, inGrade, allowsNegatives, tierFor, gen } from './practice.js';
import { store, readBackup, dayKey } from './store.js';
import { APP_VERSION } from './version.js';
import { FIREBASE_CONFIG } from './config.js';
import { esc } from './format.js';

const $ = (sel) => document.querySelector(sel);

// The Solve examples: one fresh problem per topic the current kid's class studies, at
// Medium (the CBSE level for that class). New ones every time the app opens or the kid changes.
let examples = [];

function makeExamples() {
  const grade = (store.current() || {}).grade || null;
  const topics = TOPICS.filter((t) => inGrade(t, grade)).sort(() => Math.random() - 0.5).slice(0, 7);
  const out = [];
  for (const t of topics) {
    const tier = tierFor(t, grade, 1);
    for (let i = 0; i < 20; i++) {
      const p = gen(t, tier);
      if (out.includes(p) || (!allowsNegatives(t, grade) && !noNegatives(p))) continue;
      out.push(p);
      break;
    }
  }
  // Word problems last, so the short ones sit together.
  return out.sort((a, b) => a.length - b.length);
}
const CHEERS = ['Great job!', 'Nailed it!', 'You got it!', 'Super!', 'Awesome!', 'Correct!', 'Brilliant!'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- small helpers ----------

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- the crown: worn by the kid (or kids, if tied) with the most stars ----------

const CROWN_SVG = '<svg viewBox="0 0 24 18" aria-hidden="true"><path d="M2 15 1 4l6 5 5-8 5 8 6-5-1 11z" fill="var(--star)" stroke="var(--crown-edge)" stroke-width="1.4" stroke-linejoin="round"/><circle cx="1" cy="4" r="1.6" fill="var(--star)"/><circle cx="12" cy="1.6" r="1.6" fill="var(--star)"/><circle cx="23" cy="4" r="1.6" fill="var(--star)"/></svg>';

function crownHolders() {
  const kids = store.profiles();
  if (kids.length < 2) return new Set();
  const top = Math.max(...kids.map((k) => k.stars || 0));
  if (top <= 0) return new Set();
  return new Set(kids.filter((k) => (k.stars || 0) === top).map((k) => k.id));
}

const hasCrown = (id) => crownHolders().has(id);
// A kid's name, with the crown sitting on top of it if they have the most stars.
const crownedName = (id, name) => (hasCrown(id)
  ? `<span class="crowned" title="Most stars"><span class="crown">${CROWN_SVG}</span>${esc(name)}<span class="sr-only"> (most stars)</span></span>`
  : esc(name));
const initialOf = (name) => esc((name.match(/\p{L}|\p{N}/u) || [name[0] || '?'])[0].toUpperCase());

let lastCrowned = null;
// Announce when the kid on this device takes (or shares) the crown.
function checkCrown() {
  const now = crownHolders();
  const kid = store.current();
  if (lastCrowned && kid && now.has(kid.id) && !lastCrowned.has(kid.id)) {
    toast(now.size > 1 ? `${kid.name} is sharing the crown!` : `${kid.name} takes the crown!`);
  }
  lastCrowned = now;
}

function updateStars(gained = 0) {
  if (gained) store.addStars(gained);
  $('#star-count').textContent = store.get().stars;
  updateWho();
  if (gained) checkCrown();
  if (gained) {
    const s = $('.stars');
    s.classList.remove('pop');
    void s.offsetWidth;
    s.classList.add('pop');
  }
}

function friendlyError(e) {
  if (e instanceof MathError) return e.message;
  console.error(e);
  return "Something went wrong reading that. Check the numbers and signs and try again.";
}

function stepHTML(step, i) {
  const lines = step.lines.map((l) => (l.startsWith('<div') ? l : l.includes('<ul') ? `<div>${l}</div>` : `<p>${l}</p>`)).join('');
  return `<li class="step">
    <div class="step-head"><span class="step-n">${i + 1}</span><h3>${esc(step.title)}</h3>${step.reason ? `<span class="reason">${esc(step.reason)}</span>` : ''}</div>
    <div class="expr">${step.beforeHTML}</div>
    <div class="lines">${lines}</div>
    ${step.afterHTML ? `<div class="expr after"><span class="arrow">→</span>${step.afterHTML}</div>` : ''}
  </li>`;
}

function answerHTML(res) {
  const a = res.answer;
  if (a.special) return `<div class="answer"><span class="label">Answer</span><div>${a.html}</div></div>`;
  const forms = a.forms.filter((f) => f.label && f.html.replace(/<[^>]+>/g, '') !== a.html.replace(/<[^>]+>/g, ''));
  return `<div class="answer">
    <span class="label">Answer</span>
    <div class="big">${a.html}</div>
    ${forms.length ? `<div class="forms">${forms.map((f) => `<span>${esc(f.label)}: <b>${f.html}</b></span>`).join('')}</div>` : ''}
  </div>`;
}

// ---------- solve tab ----------

const problemInput = $('#problem');

function insertAtCursor(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const pos = start + text.length;
  input.focus();
  input.setSelectionRange(pos, pos);
}

function renderExamples(fresh = true) {
  if (fresh || !examples.length) examples = makeExamples();
  const grade = (store.current() || {}).grade;
  $('#examples-label').textContent = grade ? `Try one (${gradeLabel(grade)}):` : 'Try one:';
  $('#examples').innerHTML = examples.map((e) => `<button type="button" class="chip-btn" data-ex="${esc(e)}">${esc(e.length > 32 ? `${e.slice(0, 30).replace(/\s+\S*$/, '')}\u2026` : e)}</button>`).join('')
    + '<button type="button" class="chip-btn more" data-new="1">\u21bb New examples</button>';
}

function runSolve(text, { remember = true } = {}) {
  const err = $('#solve-error');
  const out = $('#result');
  err.hidden = true;
  let res;
  try {
    res = solve(text);
  } catch (e) {
    err.textContent = friendlyError(e);
    err.hidden = false;
    out.hidden = true;
    return;
  }
  if (remember) store.addHistory(text);
  renderResult(res);
}

function renderResult(res) {
  const out = $('#result');
  const tryFirst = store.setting('hintFirst') && res.type !== 'check' && !res.answer.special && res.steps.length > 0;
  let shown = tryFirst ? 0 : res.steps.length;
  let solvedIt = false;

  out.innerHTML = `
    <div class="problem-big">${res.problemHTML}</div>
    ${tryFirst ? `
      <form class="try card" id="try-form" autocomplete="off">
        <label for="try-input"><b>What do you think the answer is?</b></label>
        <div class="try-row">
          <input id="try-input" type="text" spellcheck="false" placeholder="${res.type === 'eq' ? `${esc(res.varName)} = ?` : 'Your answer'}">
          <button class="primary" type="submit">Check</button>
        </div>
        <p id="try-verdict" class="verdict" hidden></p>
      </form>` : ''}
    <p class="hint-box" id="hint-box" hidden><b>Hint:</b> ${esc(res.hint)}</p>
    <ol class="steps" id="steps"></ol>
    <div class="controls" id="controls"></div>
    <div id="answer-slot"></div>`;
  out.hidden = false;

  const draw = () => {
    $('#steps').innerHTML = res.steps.slice(0, shown).map(stepHTML).join('');
    const done = shown >= res.steps.length;
    $('#answer-slot').innerHTML = done || solvedIt ? answerHTML(res) : '';
    const ctrls = [];
    if (!done) {
      if ($('#hint-box').hidden) ctrls.push('<button type="button" class="ghost" data-act="hint">Give me a hint</button>');
      ctrls.push(`<button type="button" class="ghost" data-act="next">${shown ? 'Next step' : 'Show the first step'}</button>`);
      ctrls.push('<button type="button" class="ghost" data-act="all">Show all steps</button>');
    }
    $('#controls').innerHTML = ctrls.join('');
  };

  $('#controls').onclick = (ev) => {
    const act = ev.target.closest('button')?.dataset.act;
    if (act === 'hint') $('#hint-box').hidden = false;
    if (act === 'next') shown++;
    if (act === 'all') shown = res.steps.length;
    if (act) draw();
    if (act === 'next' || act === 'all') $('#steps').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const tryForm = $('#try-form');
  if (tryForm) {
    tryForm.onsubmit = (ev) => {
      ev.preventDefault();
      const val = $('#try-input').value.trim();
      if (!val) return;
      const v = $('#try-verdict');
      const last = res.steps[res.steps.length - 1];
      const r = checkAnswer(val, res.answer.q, res.steps.length === 1 ? last.remainder : null);
      v.hidden = false;
      if (r.ok) {
        v.className = 'verdict good';
        v.textContent = r.close ? `Very close! The exact answer is shown below.` : `${pick(CHEERS)} That's right.${shown < res.steps.length ? ' Want to see the steps anyway?' : ''}`;
        if (!solvedIt && shown === 0) { updateStars(1); toast('+1 star'); }
        solvedIt = true;
        draw();
      } else {
        v.className = 'verdict bad';
        v.textContent = r.error || (shown === 0 ? 'Not quite. Try a hint or look at the first step.' : 'Not quite. Look at the next step.');
        $('#hint-box').hidden = false;
        draw();
      }
    };
  }
  draw();
}

// The box grows to fit a long word problem; Enter solves, Shift+Enter makes a new line.
function fitProblem() {
  problemInput.style.height = 'auto';
  problemInput.style.height = `${problemInput.scrollHeight + 4}px`;
}

function setupSolve() {
  renderExamples();
  problemInput.addEventListener('input', fitProblem);
  problemInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#solve-form').requestSubmit();
    }
  });
  $('#hint-first').checked = store.setting('hintFirst');
  $('#hint-first').onchange = (e) => {
    store.setting('hintFirst', e.target.checked);
    if (problemInput.value.trim() && !$('#result').hidden) runSolve(problemInput.value, { remember: false });
  };
  $('#solve-form').onsubmit = (e) => {
    e.preventDefault();
    runSolve(problemInput.value);
  };
  document.querySelector('.symbols').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) insertAtCursor(problemInput, b.dataset.ins);
  };
  $('#examples').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.new) { renderExamples(); return; }
    problemInput.value = b.dataset.ex;
    fitProblem();
    runSolve(b.dataset.ex);
  };

  // Camera: read a printed problem from a photo, then let the kid check it before solving.
  $('#camera-btn').onclick = () => $('#camera-input').click();
  $('#camera-input').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const status = $('#ocr-status');
    status.hidden = false;
    try {
      const { readPhoto } = await import('./ocr.js');
      const text = await readPhoto(file, (msg) => { status.textContent = msg; });
      problemInput.value = text;
      fitProblem();
      status.textContent = 'Check the problem looks right (fix it if not), then tap Solve.';
      problemInput.focus();
    } catch (err) {
      status.textContent = err.message || "Couldn't read that photo. You can type the problem instead.";
    }
  };
}

// ---------- practice tab ----------

let level = 0;
let round = null;

let showAllTopics = false;

function renderTopics() {
  const stats = store.get().topics;
  const kid = store.current();
  const grade = kid && kid.grade;
  $('#level').innerHTML = LEVELS.map((l, i) => `<button type="button" role="radio" aria-checked="${i === level}" data-level="${i}">${l} <small>★${LEVEL_STARS[i]}</small></button>`).join('');
  $('#grade-line').innerHTML = grade
    ? `<b>${gradeLabel(grade)}</b> topics${kid ? ` for ${esc(kid.name)}` : ''}. <button type="button" class="linkish" data-gl="toggle">${showAllTopics ? 'Show only this grade' : 'Show all topics'}</button>`
    : `No class set, so every topic is shown. A grown-up can set the CBSE class under <a href="#progress">Progress</a>.`;
  const list = TOPICS.filter((t) => !grade || showAllTopics || inGrade(t, grade));
  $('#topics').innerHTML = list.map((t) => {
    const s = stats[t.id];
    const pct = s && s.tries ? Math.round((100 * s.firstTry) / s.tries) : null;
    return `<button type="button" class="topic" data-topic="${t.id}">
      <b>${esc(t.name)}</b>
      <span class="sample">${esc(t.sample)}</span>
      ${pct === null ? '<span class="acc">Not tried yet</span>' : `<span class="acc">${pct}% first try</span><span class="meter"><i style="width:${pct}%"></i></span>`}
    </button>`;
  }).join('');
}

function noNegatives(text) {
  try {
    const r = solve(text);
    return r.answer.q && r.answer.q.sign() >= 0;
  } catch {
    return false;
  }
}

// ---------- Solve is locked during a practice round ----------
// So a practice question can't be typed into Solve to get the answer. Finishing or
// stopping the round unlocks it.
const LOCK_MESSAGE = 'Finish your round first, or tap Stop to leave it.';
const roundActive = () => !!round && !round.done;

function updateSolveLock() {
  const tab = document.querySelector('.tabs a[data-tab="solve"]');
  const locked = roundActive();
  tab.classList.toggle('locked', locked);
  if (locked) {
    tab.setAttribute('aria-disabled', 'true');
    tab.title = LOCK_MESSAGE;
  } else {
    tab.removeAttribute('aria-disabled');
    tab.removeAttribute('title');
  }
}

function startRound(topicId) {
  if (updateWaiting) { applyUpdateIfSafe(); return; }
  const topic = TOPICS.find((t) => t.id === topicId);
  const grade = (store.current() || {}).grade || null;
  const accept = allowsNegatives(topic, grade) ? () => true : noNegatives;
  round = { topic, grade, problems: makeRound(topicId, level, 10, accept, grade), i: 0, results: [], tries: 0, stars: 0, firstTry: 0 };
  updateSolveLock();
  $('#practice-setup').hidden = true;
  $('#practice-done').hidden = true;
  $('#practice-play').hidden = false;
  $('#play-topic').innerHTML = `<span class="label">${esc(topic.name)} · ${LEVELS[level]}${grade ? ` · ${gradeLabel(grade)}` : ''}</span>`;
  showQuestion();
}

function showQuestion() {
  const text = round.problems[round.i];
  round.solved = solve(text);
  round.tries = 0;
  round.finished = false;
  $('#question').innerHTML = round.solved.problemHTML;
  $('#answer').value = '';
  $('#answer').placeholder = round.solved.type === 'eq' ? `${round.solved.varName} = ?` : '?';
  $('#feedback').className = 'feedback';
  $('#feedback').innerHTML = '';
  $('#play-steps').innerHTML = '';
  $('#check-btn').textContent = 'Check';
  $('#play-count').textContent = `${round.i + 1} / ${round.problems.length}`;
  drawDots();
  if (window.matchMedia('(pointer: fine)').matches) $('#answer').focus();
}

function drawDots() {
  $('#dots').innerHTML = round.problems.map((_, k) => `<i class="${round.results[k] === true ? 'right' : round.results[k] === false ? 'wrong' : k === round.i ? 'now' : ''}"></i>`).join('');
}

function showPracticeSteps() {
  $('#play-steps').innerHTML = `<ol class="steps">${round.solved.steps.map(stepHTML).join('')}</ol>${answerHTML(round.solved)}`;
}

function finishQuestion(right, firstTry) {
  round.finished = true;
  round.results[round.i] = right;
  drawDots();
  if (firstTry) round.firstTry++;
  const streak = store.recordPractice(round.topic.id, { firstTry, right });
  let gained = firstTry ? LEVEL_STARS[level] : 0;
  if (firstTry && streak > 0 && streak % 5 === 0) {
    gained += 3;
    toast(`${streak} in a row! +3 bonus stars`);
  }
  round.stars += gained;
  updateStars(gained);
  $('#check-btn').textContent = round.i === round.problems.length - 1 ? 'Finish' : 'Next';
}

function checkPractice() {
  if (round.finished) {
    round.i++;
    if (round.i >= round.problems.length) return endRound();
    return showQuestion();
  }
  const val = $('#answer').value.trim();
  if (!val) return;
  const fb = $('#feedback');
  const r = checkAnswer(val, round.solved.answer.q);
  if (r.error) {
    fb.className = 'feedback bad';
    fb.innerHTML = `<span class="grow">${esc(r.error)}</span>`;
    return;
  }
  round.tries++;
  if (r.ok) {
    fb.className = 'feedback good';
    fb.innerHTML = `<span class="grow">${round.tries === 1 ? `${pick(CHEERS)} +${LEVEL_STARS[level]} star${LEVEL_STARS[level] > 1 ? 's' : ''}` : 'Yes! You got it on the second try.'}</span>`;
    finishQuestion(true, round.tries === 1);
  } else if (round.tries === 1) {
    fb.className = 'feedback bad';
    fb.innerHTML = `<span class="grow">Not quite. Have another go!</span><button type="button" class="ghost small" id="p-hint">Hint</button>`;
    $('#p-hint').onclick = () => {
      fb.querySelector('.grow').innerHTML = `<b>Hint:</b> ${esc(round.solved.hint)}`;
      $('#p-hint').remove();
    };
    $('#answer').select();
  } else {
    fb.className = 'feedback bad';
    fb.innerHTML = `<span class="grow">The answer is <b>${round.solved.answer.html}</b>.</span><button type="button" class="ghost small" id="p-how">Show me how</button>`;
    $('#p-how').onclick = () => { showPracticeSteps(); $('#p-how').remove(); };
    finishQuestion(false, false);
  }
}

function endRound() {
  round.done = true; // the score screen is showing; safe to update after this
  updateSolveLock();
  const right = round.results.filter(Boolean).length;
  const total = round.problems.length;
  const msg = right === total ? 'Perfect round!' : right >= total * 0.8 ? 'Excellent work!' : right >= total * 0.5 ? 'Good effort! Practice makes progress.' : 'That was a tough one. Try Easy level, then work back up.';
  $('#practice-play').hidden = true;
  const done = $('#practice-done');
  done.hidden = false;
  done.innerHTML = `
    <span class="label">${esc(round.topic.name)} · ${LEVELS[level]}</span>
    <div class="score">${right} / ${total}</div>
    <h2>${msg}</h2>
    <p class="muted">${round.firstTry} right on the first try · ${round.stars} star${round.stars === 1 ? '' : 's'} earned</p>
    ${level === 2 && right >= 9 && round.grade && round.grade < 8 ? `<p class="tip">Brilliant on Hard for ${gradeLabel(round.grade)}! Ask a grown-up about moving up to ${gradeLabel(round.grade + 1)}.</p>` : ''}
    <div class="row">
      <button type="button" class="primary" id="again">Play again</button>
      ${level < 2 && right >= 8 ? '<button type="button" class="ghost" id="harder">Try a harder level</button>' : ''}
      <button type="button" class="ghost" id="pick">Pick another topic</button>
    </div>`;
  const id = round.topic.id;
  $('#again').onclick = () => startRound(id);
  if ($('#harder')) $('#harder').onclick = () => { level++; startRound(id); };
  $('#pick').onclick = backToTopics;
}

function backToTopics() {
  round = null;
  updateSolveLock();
  applyUpdateIfSafe();
  $('#practice-play').hidden = true;
  $('#practice-done').hidden = true;
  $('#practice-setup').hidden = false;
  renderTopics();
}

function setupPractice() {
  renderTopics();
  $('#level').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    level = Number(b.dataset.level);
    renderTopics();
  };
  $('#topics').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) startRound(b.dataset.topic);
  };
  $('#grade-line').onclick = (e) => {
    if (!e.target.closest('[data-gl]')) return;
    showAllTopics = !showAllTopics;
    renderTopics();
  };
  $('#quit').onclick = backToTopics;
  $('#answer-form').onsubmit = (e) => { e.preventDefault(); checkPractice(); };
  $('#keypad').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || !b.dataset.k) return;
    const input = $('#answer');
    if (round && round.finished) return;
    // After a wrong try the old answer is selected, so the next key replaces it.
    const allSelected = input.value && input.selectionStart === 0 && input.selectionEnd === input.value.length;
    if (b.dataset.k === 'back') input.value = allSelected ? '' : input.value.slice(0, -1);
    else input.value = (allSelected ? '' : input.value) + b.dataset.k;
    input.setSelectionRange(input.value.length, input.value.length);
  };
}

// ---------- progress tab ----------

// Which grown-up action is open: null, 'rename', 'reset' or 'delete'.
let manage = null;

function manageHTML(kid) {
  const name = esc(kid.name);
  if (manage === 'rename') {
    return `<form class="rename-row" id="rename-form" autocomplete="off">
        <label for="rename-input" class="sr-only">New name</label>
        <input id="rename-input" type="text" maxlength="20" value="${name}" autocapitalize="words" spellcheck="false">
        <button type="submit" class="primary small">Save</button>
        <button type="button" class="ghost small" data-m="cancel">Cancel</button>
      </form>
      <p id="manage-error" class="error" role="alert" hidden></p>`;
  }
  if (manage === 'reset') {
    return `<p style="margin:0 0 10px">Erase ${name}'s stars, streaks and topic stats? The profile stays.</p>
      <div class="row"><button type="button" class="ghost danger" data-m="reset-yes">Yes, erase progress</button><button type="button" class="ghost" data-m="cancel">Cancel</button></div>`;
  }
  if (manage === 'delete') {
    return `<p style="margin:0 0 10px">Delete ${name}'s profile and all of their progress? This can't be undone.</p>
      <div class="row"><button type="button" class="ghost danger" data-m="delete-yes">Yes, delete ${name}</button><button type="button" class="ghost" data-m="cancel">Cancel</button></div>`;
  }
  return `<div class="grade-row">
      <label for="grade-select">CBSE class</label>
      <select id="grade-select" class="grade-select">${gradeOptions(kid.grade)}</select>
    </div>
    <p class="muted small-note" style="margin:0 0 12px">Practice follows the CBSE syllabus for this class: Medium is what the class expects, Easy is a step below and Hard a step above.</p>
    <div class="row">
      <button type="button" class="ghost small" data-m="rename">Rename</button>
      <button type="button" class="ghost small" data-m="reset">Reset progress</button>
      <button type="button" class="ghost small danger" data-m="delete">Delete profile</button>
    </div>`;
}


// <option>s for the school-year pickers.
function gradeOptions(selected) {
  return `<option value="">Class: not set</option>${GRADES.map((g) => `<option value="${g}"${g === selected ? ' selected' : ''}>${gradeLabel(g)} (${gradeAges(g)})</option>`).join('')}`;
}

// ---------- family view: every kid side by side, for grown-ups ----------

let progressView = 'kid'; // 'kid' or 'family'

function firstTryRate(topics) {
  let tries = 0, first = 0;
  for (const t of Object.values(topics || {})) { tries += t.tries || 0; first += t.firstTry || 0; }
  return tries ? { pct: Math.round((100 * first) / tries), tries } : null;
}

function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), full: d.toLocaleDateString(undefined, { weekday: 'long' }) });
  }
  return out;
}

const band = (pct) => (pct >= 80 ? 'good' : pct >= 60 ? 'ok' : 'low');

function weakestTopic(topics) {
  return TOPICS.map((t) => ({ t, st: (topics || {})[t.id] }))
    .filter((r) => r.st && r.st.tries >= 5)
    .sort((a, b) => a.st.firstTry / a.st.tries - b.st.firstTry / b.st.tries)[0] || null;
}

function familyHTML() {
  const kids = store.family();
  const week = lastDays(7);
  const avatar = (k) => `<span class="avatar c${k.color}" aria-hidden="true">${initialOf(k.name)}</span>`;
  const cards = kids.map((k) => {
    const d = k.data;
    const rate = firstTryRate(d.topics);
    const thisWeek = week.reduce((n, w) => n + ((d.days || {})[w.key] || 0), 0);
    const weak = weakestTopic(d.topics);
    const weakPct = weak ? Math.round((100 * weak.st.firstTry) / weak.st.tries) : null;
    return `<article class="fam-kid">
      <header>${avatar(k)}<div><b>${crownedName(k.id, k.name)}</b><small>${k.grade ? `${gradeLabel(k.grade)} · ${gradeAges(k.grade)}` : 'Class not set'}</small></div></header>
      <dl>
        <div><dt>Stars</dt><dd>★ ${d.stars}</dd></div>
        <div><dt>Right first try</dt><dd>${rate ? `<span class="pct ${band(rate.pct)}">${rate.pct}%</span>` : '–'}</dd></div>
        <div><dt>This week</dt><dd>${thisWeek} problem${thisWeek === 1 ? '' : 's'}</dd></div>
        <div><dt>Problems right</dt><dd>${d.solved}</dd></div>
        <div><dt>Best streak</dt><dd>${d.bestStreak}</dd></div>
      </dl>
      <p class="fam-note">${weak && weakPct < 80 ? `Needs practice: <b>${esc(weak.t.name)}</b> (${weakPct}%)` : rate ? 'Doing well in every topic tried so far.' : 'No practice yet.'}</p>
      <button type="button" class="ghost small" data-open="${k.id}">See ${esc(k.name)}'s progress</button>
    </article>`;
  }).join('');

  const tried = TOPICS.filter((t) => kids.some((k) => ((k.data.topics || {})[t.id] || {}).tries));
  const topicTable = tried.length ? `<div class="table-scroll"><table class="fam-table">
      <thead><tr><th scope="col">Topic</th>${kids.map((k) => `<th scope="col">${crownedName(k.id, k.name)}</th>`).join('')}</tr></thead>
      <tbody>${tried.map((t) => `<tr><th scope="row">${esc(t.name)}</th>${kids.map((k) => {
        const st = (k.data.topics || {})[t.id];
        if (!st || !st.tries) return '<td class="none">–</td>';
        const pct = Math.round((100 * st.firstTry) / st.tries);
        return `<td><span class="pct ${band(pct)}">${pct}%</span><small>${st.tries}</small></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">No practice yet. Topics show up here once the kids practice.</p>';

  const max = Math.max(1, ...kids.flatMap((k) => week.map((w) => (k.data.days || {})[w.key] || 0)));
  const weekTable = `<div class="table-scroll"><table class="fam-table week">
      <thead><tr><th scope="col">Kid</th>${week.map((w, i) => `<th scope="col" title="${esc(w.full)}"${i === week.length - 1 ? ' class="today"' : ''}>${esc(w.label)}</th>`).join('')}</tr></thead>
      <tbody>${kids.map((k) => `<tr><th scope="row">${crownedName(k.id, k.name)}</th>${week.map((w) => {
        const n = (k.data.days || {})[w.key] || 0;
        return `<td><span class="heat" style="--h:${n ? 0.15 + 0.85 * (n / max) : 0}">${n || ''}</span></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>`;

  const lonely = kids.length < 2
    ? `<p class="tip">Only ${esc(kids[0].name)} is on this device. To compare kids, add another kid (tap the name at the top)${FIREBASE_CONFIG ? ', or turn on family sync so every kid shows up on every device' : ''}.</p>`
    : '';
  return `${lonely}<div class="fam-grid">${cards}</div>
    <div class="card">
      <h2>Topics side by side</h2>
      <p class="muted">Percent right on the first try. The small number is how many problems they've done.
        <span class="key"><span class="pct good">80%+</span> <span class="pct ok">60–79%</span> <span class="pct low">under 60%</span></span></p>
      ${topicTable}
    </div>
    <div class="card">
      <h2>Practice in the last 7 days</h2>
      <p class="muted">Problems answered each day. The last column is today.</p>
      ${weekTable}
    </div>`;
}

function renderProgress() {
  const s = store.get();
  const kid = store.current();
  // Always offer the family view, so grown-ups can find it even before a second kid is added.
  const hasKids = store.profiles().length > 0;
  if (!hasKids) progressView = 'kid';
  $('#progress-switch').hidden = !hasKids;
  $('#progress-switch').innerHTML = hasKids ? `
    <button type="button" role="tab" aria-selected="${progressView === 'kid'}" data-pv="kid">${kid ? crownedName(kid.id, kid.name) : 'Kid'}</button>
    <button type="button" role="tab" aria-selected="${progressView === 'family'}" data-pv="family">Family</button>` : '';
  $('#progress-switch').onclick = (e) => {
    const b = e.target.closest('[data-pv]');
    if (!b) return;
    progressView = b.dataset.pv;
    renderProgress();
  };
  if (progressView === 'family') {
    $('#progress-h').textContent = 'Family progress';
    $('#progress-body').innerHTML = familyHTML();
    $('#progress-body').onclick = (e) => {
      const b = e.target.closest('[data-open]');
      if (!b) return;
      progressView = 'kid';
      store.switchTo(b.dataset.open);
      onKidChanged();
    };
    return;
  }
  $('#progress-h').innerHTML = kid ? `${crownedName(kid.id, kid.name)}'s progress` : 'Progress';
  const rows = TOPICS.map((t) => ({ t, st: s.topics[t.id] })).filter((r) => r.st && r.st.tries);
  const weak = rows.filter((r) => r.st.tries >= 5).sort((a, b) => a.st.firstTry / a.st.tries - b.st.firstTry / b.st.tries)[0];
  const others = store.profiles().filter((p) => !kid || p.id !== kid.id);
  $('#progress-body').innerHTML = `
    <div class="tiles">
      <div class="tile"><b>${s.stars}</b><span>stars</span></div>
      <div class="tile"><b>${s.solved}</b><span>practice problems right</span></div>
      <div class="tile"><b>${s.bestStreak}</b><span>best streak</span></div>
    </div>
    ${weak && weak.st.firstTry / weak.st.tries < 0.8 ? `<p class="tip">Worth more practice: <b>${esc(weak.t.name)}</b> (${Math.round((100 * weak.st.firstTry) / weak.st.tries)}% right on the first try).</p>` : ''}
    <div class="card">
      <h2>By topic</h2>
      <p class="muted">Percent right on the first try.</p>
      <div class="stat-list" style="margin-top:12px">
        ${rows.length ? rows.map(({ t, st }) => {
          const pct = Math.round((100 * st.firstTry) / st.tries);
          return `<div class="stat"><span>${esc(t.name)}</span><small>${pct}% \u00b7 ${st.firstTry}/${st.tries}</small><span class="meter"><i style="width:${pct}%"></i></span></div>`;
        }).join('') : '<p class="muted">No practice yet. Pick a topic in Practice to start.</p>'}
      </div>
    </div>
    <div class="card">
      <h2>Recent problems</h2>
      <div class="history" style="margin-top:10px">
        ${s.history.length ? s.history.map((h) => `<button type="button" class="chip-btn" data-h="${esc(h)}">${esc(h.length > 40 ? `${h.slice(0, 38)}…` : h)}</button>`).join('') : '<p class="muted">Problems you solve will show up here.</p>'}
      </div>
    </div>
    ${others.length ? `<div class="card">
      <h2>Other kids</h2>
      <div class="who-list" style="margin-top:10px">${others.map((p) => kidButton(p, false)).join('')}</div>
    </div>` : ''}
    ${kid ? `<div class="card">
      <h2>For grown-ups</h2>
      <p class="muted" style="margin:6px 0 12px">${store.syncInfo() ? 'Progress is saved on this device and synced to your family account.' : 'Progress is saved on this device. Nothing is uploaded.'}</p>
      ${manageHTML(kid)}
    </div>` : ''}
    ${FIREBASE_CONFIG ? '<div class="card" id="sync-card"></div>' : ''}
    <div class="card">
      <h2>Move progress to another device</h2>
      <p class="muted" style="margin:6px 0 12px">Save every kid's progress to a file. Choose <b>Drive</b> to keep it in Google Drive. On the other device, open Math Buddy and tap <b>Load progress</b>.</p>
      <div class="row">
        <button type="button" class="primary small" data-b="save">Save progress</button>
        <button type="button" class="ghost small" data-b="load">Load progress</button>
      </div>
      <div id="progress-backup">${backupPreviewHTML('progress')}</div>
    </div>`;

  drawSync();
  const body = $('#progress-body');
  body.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.h) {
      if (roundActive()) { toast(LOCK_MESSAGE); return; }
      problemInput.value = b.dataset.h; location.hash = '#solve'; fitProblem(); runSolve(b.dataset.h); return;
    }
    if (b.dataset.kid) { switchKid(b.dataset.kid); return; }
    if (b.dataset.b) { handleBackup(b.dataset.b, 'progress'); return; }
    const m = b.dataset.m;
    if (!m) return;
    if (m === 'cancel') manage = null;
    else if (m === 'reset-yes') { store.reset(); manage = null; updateStars(); toast('Progress erased'); }
    else if (m === 'delete-yes') {
      const gone = kid.name;
      store.deleteProfile(kid.id);
      manage = null;
      onKidChanged();
      toast(`Deleted ${gone}`);
      if (!store.current()) openWho();
      return;
    } else manage = m;
    renderProgress();
    if (manage === 'rename') { const i = $('#rename-input'); i.focus(); i.select(); }
  };
  const gs = $('#grade-select');
  if (gs) {
    gs.onchange = () => {
      store.setGrade(kid.id, gs.value || null);
      const g = store.current().grade;
      toast(g ? `${kid.name}: ${gradeLabel(g)}` : `${kid.name}: class not set`);
      renderExamples();
    };
  }
  const rename = $('#rename-form');
  if (rename) {
    rename.onsubmit = (e) => {
      e.preventDefault();
      try {
        store.renameProfile(kid.id, $('#rename-input').value);
        manage = null;
        updateWho();
        renderProgress();
      } catch (err) {
        $('#manage-error').textContent = err.message;
        $('#manage-error').hidden = false;
      }
    };
  }
}

// ---------- moving progress between devices ----------

let pendingBackup = null; // a checked file waiting for "Load progress"
let backupNote = null; // { text, error } shown under the buttons
let backupWhere = 'progress'; // where the Load button was tapped: 'progress' or 'who'

function backupPreviewHTML(where) {
  if (backupWhere !== where) return '';
  if (!pendingBackup) {
    return backupNote ? `<p class="${backupNote.error ? 'error' : 'tip'}" style="margin-top:12px">${esc(backupNote.text)}</p>` : '';
  }
  const items = store.previewBackup(pendingBackup);
  const when = pendingBackup.savedAt && !Number.isNaN(pendingBackup.savedAt.getTime())
    ? ` (saved ${pendingBackup.savedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })})`
    : '';
  return `<div class="load-preview">
    <p><b>This file has${when}:</b></p>
    <ul>${items.map((i) => `<li><b>${esc(i.name)}</b> \u2605 ${i.stars}: ${i.replaces ? `replaces ${esc(i.replaces.name)}'s progress on this device (\u2605 ${i.replaces.stars})` : 'new on this device'}</li>`).join('')}</ul>
    <div class="row">
      <button type="button" class="primary small" data-b="load-yes">Load progress</button>
      <button type="button" class="ghost small" data-b="load-no">Cancel</button>
    </div>
  </div>`;
}

function redrawBackup() {
  if (backupWhere === 'who') $('#who-backup').innerHTML = backupPreviewHTML('who');
  else if (!$('#view-progress').hidden) renderProgress();
}

// Android's share sheet lets you pick Drive. Chrome only shares some file types,
// so try a .json file first, then the same text as a .txt file, then a plain download.
async function saveBackup() {
  if (!store.profiles().length) {
    backupNote = { text: 'There is no progress to save yet. Add a kid first.', error: true };
    return redrawBackup();
  }
  const text = JSON.stringify(store.exportBackup(APP_VERSION), null, 2);
  const day = new Date().toISOString().slice(0, 10);
  const base = `math-buddy-progress-${day}`;
  const candidates = [
    new File([text], `${base}.json`, { type: 'application/json' }),
    new File([text], `${base}.txt`, { type: 'text/plain' }),
  ];
  const shareable = navigator.canShare && candidates.find((f) => { try { return navigator.canShare({ files: [f] }); } catch { return false; } });
  if (shareable) {
    try {
      await navigator.share({ files: [shareable], title: 'Math Buddy progress' });
      backupNote = { text: `Saved ${shareable.name}. Keep it somewhere you can reach from the other device, like Google Drive.`, error: false };
      return redrawBackup();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(candidates[0]);
  const a = document.createElement('a');
  a.href = url;
  a.download = candidates[0].name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  backupNote = { text: `Saved ${candidates[0].name} to this device's Downloads. Upload it to Google Drive to use it on another device.`, error: false };
  redrawBackup();
}

function handleBackup(action, where) {
  backupWhere = where;
  if (action === 'save') { backupNote = null; saveBackup(); return; }
  if (action === 'load') { backupNote = null; pendingBackup = null; $('#backup-input').click(); return; }
  if (action === 'load-no') { pendingBackup = null; backupNote = null; redrawBackup(); return; }
  if (action === 'load-yes' && pendingBackup) {
    const names = pendingBackup.profiles.map((p) => p.name);
    const { added, replaced } = store.loadBackup(pendingBackup);
    pendingBackup = null;
    backupNote = { text: `Loaded progress for ${names.join(', ')}.${added ? ` ${added} new.` : ''}${replaced ? ` ${replaced} updated.` : ''}`, error: false };
    if (where === 'who') $('#who-sheet').hidden = true;
    onKidChanged();
    redrawBackup();
    toast('Progress loaded');
  }
}

function setupBackup() {
  $('#backup-input').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("That file is too big to be a Math Buddy progress file.");
      pendingBackup = readBackup(await file.text());
      backupNote = null;
    } catch (err) {
      pendingBackup = null;
      backupNote = { text: err.message || "Couldn't read that file.", error: true };
    }
    redrawBackup();
  };
  $('#app-version').textContent = APP_VERSION;
}

// ---------- family sync ----------
// Sign in once per device with the family email and password; progress then stays the
// same on every device. The sync code only loads when family sync is set up and used.

let sync = null;
let syncStarting = null;
let syncStatus = null;
let syncConflicts = null; // [{ name, here, family }] while a joining device decides
let syncResolve = null;
const syncForm = { email: '', password: '', error: '', info: '', busy: false, confirmOff: false };

function startSync() {
  if (!FIREBASE_CONFIG) return Promise.resolve(null);
  if (sync) return Promise.resolve(sync);
  syncStarting ||= (async () => {
    const [{ createSync }, { createFirebaseCloud }] = await Promise.all([import('./sync.js'), import('./cloud-firebase.js')]);
    const cloud = await createFirebaseCloud(FIREBASE_CONFIG);
    sync = createSync({
      store,
      cloud,
      onChange: onSyncedChange,
      onStatus: (st) => { syncStatus = st; drawSync(); },
      askConflicts: (list) => new Promise((resolve) => {
        syncConflicts = list;
        syncResolve = resolve;
        if (location.hash !== '#progress') location.hash = '#progress';
        drawSync();
      }),
    });
    return sync;
  })().catch((err) => {
    syncStarting = null;
    syncStatus = { state: 'error', error: "Couldn't start family sync. Check the internet connection and try again." };
    console.error(err);
    drawSync();
    return null;
  });
  return syncStarting;
}

// Something arrived from another device: refresh what's on screen without interrupting.
function onSyncedChange() {
  const kid = store.current();
  // The first-run "Who's using Math Buddy?" sheet closes once the family's kids arrive.
  if (kid && !$('#who-sheet').hidden && $('#who-close').hidden) $('#who-sheet').hidden = true;
  updateWho();
  updateStars();
  $('#hint-first').checked = store.setting('hintFirst');
  if (!$('#view-progress').hidden && !document.activeElement?.closest?.('#sync-card, #rename-form')) renderProgress();
  if (!$('#view-practice').hidden && !round) renderTopics();
  if (!kid) openWho();
}

const SYNC_STATE_TEXT = {
  joining: 'Connecting\u2026',
  synced: '\u2714 All changes saved',
  saving: 'Saving\u2026',
  offline: 'Offline. Changes are saved on this device and will sync when it\'s back online.',
};

function syncCardHTML() {
  const st = syncStatus || { state: store.syncInfo() ? 'joining' : 'signed-out', email: (store.syncInfo() || {}).email };
  const note = (t, cls) => (t ? `<p class="${cls}" style="margin:10px 0 0">${esc(t)}</p>` : '');
  if (syncConflicts) {
    return `<h2>Family sync</h2>
      <p class="muted" style="margin:6px 0 10px">These kids are on this device and in the family account. What should happen to this device's progress?</p>
      <form id="sync-conflicts" class="conflicts">
        ${syncConflicts.map((c, i) => `<fieldset>
          <legend><b>${esc(c.name)}</b>: \u2605 ${c.here} here, \u2605 ${c.family} in the family account</legend>
          <label><input type="radio" name="c${i}" value="cloud" checked> Use the family account's progress <span class="muted">(recommended if you copied it here with a file)</span></label>
          <label><input type="radio" name="c${i}" value="add"> Add this device's progress too <span class="muted">(\u2605 ${c.here + c.family})</span></label>
        </fieldset>`).join('')}
        <button class="primary small" type="submit">Continue</button>
      </form>`;
  }
  if (st.state !== 'signed-out' && (st.email || store.syncInfo())) {
    const email = st.email || (store.syncInfo() || {}).email || '';
    return `<h2>Family sync</h2>
      <p style="margin:6px 0 0">On for <b>${esc(email)}</b>. Kids' progress stays the same on every device signed in to this account.</p>
      ${st.state === 'error' ? note(st.error, 'error') : `<p class="sync-state ${st.state}">${esc(SYNC_STATE_TEXT[st.state] || '')}</p>`}
      ${syncForm.confirmOff
        ? `<p style="margin:12px 0 8px">Turn off family sync on this device? Progress stays here, but stops syncing.</p>
           <div class="row"><button type="button" class="ghost small danger" data-s="off-yes">Turn off</button><button type="button" class="ghost small" data-s="off-no">Cancel</button></div>`
        : '<div class="row" style="margin-top:12px"><button type="button" class="ghost small" data-s="off">Turn off on this device</button></div>'}`;
  }
  const paused = store.syncInfo();
  return `<h2>Family sync</h2>
    ${paused ? `<p class="tip" style="margin:6px 0 12px">This device was signed out of <b>${esc(paused.email || 'the family account')}</b>. Sign in again to keep syncing. Progress made in the meantime is kept and will be sent.</p>` : ''}
    <p class="muted" style="margin:6px 0 12px">Sign in once on each device with your family email and password. Each kid's progress then stays the same on all of them, even after practicing offline.</p>
    <form id="sync-form" class="sync-form" autocomplete="on">
      <label for="sync-email" class="label">Family email</label>
      <input id="sync-email" type="email" autocomplete="username" value="${esc(syncForm.email || (paused && paused.email) || '')}" ${syncForm.busy ? 'disabled' : ''}>
      <label for="sync-password" class="label">Password</label>
      <input id="sync-password" type="password" autocomplete="current-password" minlength="6" ${syncForm.busy ? 'disabled' : ''}>
      <div class="row">
        <button type="submit" class="primary small" data-s="signin" ${syncForm.busy ? 'disabled' : ''}>${syncForm.busy ? 'Please wait\u2026' : 'Sign in'}</button>
        <button type="button" class="ghost small" data-s="signup" ${syncForm.busy ? 'disabled' : ''}>Create family account</button>
        <button type="button" class="linkish" data-s="reset" ${syncForm.busy ? 'disabled' : ''}>Forgot password?</button>
      </div>
      <p class="muted small-note">New here? Type an email and a password (at least 6 characters), then tap <b>Create family account</b>. Use the same email and password on your other devices.</p>
    </form>
    ${note(syncForm.error || (st.state === 'error' ? st.error : ''), 'error')}${note(syncForm.info, 'tip')}`;
}

function drawSync() {
  const card = $('#sync-card');
  if (!card) return;
  card.innerHTML = syncCardHTML();
  const form = $('#sync-form');
  if (form) {
    $('#sync-email').oninput = (e) => { syncForm.email = e.target.value; };
    form.onsubmit = (e) => { e.preventDefault(); syncAction('signin'); };
  }
  const cf = $('#sync-conflicts');
  if (cf) {
    cf.onsubmit = (e) => {
      e.preventDefault();
      const choices = {};
      syncConflicts.forEach((c, i) => { choices[c.name] = cf.querySelector(`input[name="c${i}"]:checked`).value; });
      const resolve = syncResolve;
      syncConflicts = null;
      syncResolve = null;
      drawSync();
      resolve(choices);
    };
  }
  card.onclick = (e) => {
    const b = e.target.closest('button[data-s]');
    if (b && b.type !== 'submit') syncAction(b.dataset.s);
  };
}

async function syncAction(action) {
  syncForm.error = '';
  syncForm.info = '';
  if (action === 'off') { syncForm.confirmOff = true; return drawSync(); }
  if (action === 'off-no') { syncForm.confirmOff = false; return drawSync(); }
  if (action === 'off-yes') {
    syncForm.confirmOff = false;
    const s = await startSync();
    if (s) await s.signOut();
    else store.setSyncInfo(null);
    syncStatus = { state: 'signed-out' };
    toast('Family sync is off on this device');
    return drawSync();
  }
  const email = ($('#sync-email') && $('#sync-email').value.trim()) || syncForm.email.trim();
  const password = ($('#sync-password') && $('#sync-password').value) || '';
  syncForm.email = email;
  if (!email) { syncForm.error = 'Type the family email first.'; return drawSync(); }
  if (action !== 'reset' && !password) { syncForm.error = 'Type the password.'; return drawSync(); }
  syncForm.busy = true;
  drawSync();
  try {
    const s = await startSync();
    if (!s) throw new Error("Couldn't start family sync. Check the internet connection and try again.");
    const { friendlyAuthError } = await import('./sync.js');
    try {
      if (action === 'signin') await s.signIn(email, password);
      if (action === 'signup') await s.signUp(email, password);
      if (action === 'reset') {
        await s.resetPassword(email);
        syncForm.info = `If ${email} has a family account, a link to set a new password is on its way. Check the inbox (and spam).`;
      }
    } catch (err) {
      syncForm.error = friendlyAuthError(err);
    }
  } catch (err) {
    syncForm.error = err.message;
  }
  syncForm.busy = false;
  drawSync();
}

// ---------- profiles ----------

function kidButton(p, isCurrent) {
  return `<button type="button" class="kid" data-kid="${p.id}" aria-current="${isCurrent}">
    <span class="avatar big c${p.color}" aria-hidden="true">${initialOf(p.name)}</span>
    <b>${crownedName(p.id, p.name)}</b>
    <small>\u2605 ${p.stars}</small>
  </button>`;
}

function updateWho() {
  const kid = store.current();
  $('#who').hidden = !kid;
  if (!kid) return;
  const av = $('#who-avatar');
  av.className = `avatar c${kid.color}`;
  av.innerHTML = initialOf(kid.name);
  $('#who-name').innerHTML = crownedName(kid.id, kid.name);
  $('#who').setAttribute('aria-label', `${kid.name}${hasCrown(kid.id) ? ', wearing the crown' : ''}. Switch kid`);
}

function openWho() {
  const kid = store.current();
  const list = store.profiles();
  $('#who-h').textContent = list.length ? "Who's practicing?" : "Who's using Math Buddy?";
  const sub = [];
  if (!list.length) sub.push('Add a name for each kid. Everyone gets their own stars and progress.');
  if (store.hasOldProgress()) sub.push('The progress already on this phone will go to the first name you add.');
  $('#who-sub').textContent = sub.join(' ');
  $('#who-sub').hidden = !sub.length;
  $('#who-list').innerHTML = list.map((p) => kidButton(p, !!kid && p.id === kid.id)).join('');
  $('#who-error').hidden = true;
  $('#kid-name').value = '';
  $('#kid-grade').innerHTML = gradeOptions(null);
  $('#who-close').hidden = !kid;
  $('#who-sync').hidden = !FIREBASE_CONFIG || !!store.syncInfo();
  if (backupWhere === 'who') { pendingBackup = null; backupNote = null; }
  $('#who-backup').innerHTML = '';
  $('#who-sheet').hidden = false;
  if (!list.length) $('#kid-name').focus();
}

function closeWho() {
  if (!store.current()) return;
  $('#who-sheet').hidden = true;
}

// Everything on screen belongs to one kid, so redraw it all when the kid changes.
function onKidChanged() {
  manage = null;
  updateWho();
  updateStars();
  $('#hint-first').checked = store.setting('hintFirst');
  if (round) backToTopics();
  renderExamples();
  if (problemInput.value.trim() && !$('#result').hidden) runSolve(problemInput.value, { remember: false });
  route({ keepScroll: true });
}

function switchKid(id) {
  store.switchTo(id);
  $('#who-sheet').hidden = true;
  onKidChanged();
  toast(`Hi, ${store.current().name}!`);
}

let whoReady = false;

function setupWho() {
  whoReady = true;
  $('#who').onclick = openWho;
  $('#who-close').onclick = closeWho;
  $('#who-sheet').onclick = (e) => {
    if (e.target === e.currentTarget) return closeWho();
    const bb = e.target.closest('button[data-b]');
    if (bb) return handleBackup(bb.dataset.b, 'who');
    if (e.target.closest('#who-sync-btn')) {
      $('#who-sheet').hidden = true;
      location.hash = '#progress';
      setTimeout(() => $('#sync-email') && $('#sync-email').focus(), 50);
      return;
    }
    const b = e.target.closest('button[data-kid]');
    if (b) switchKid(b.dataset.kid);
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#who-sheet').hidden) closeWho();
  });
  $('#add-kid').onsubmit = (e) => {
    e.preventDefault();
    try {
      const id = store.addProfile($('#kid-name').value);
      if ($('#kid-grade').value) store.setGrade(id, $('#kid-grade').value);
    } catch (err) {
      $('#who-error').textContent = err.message;
      $('#who-error').hidden = false;
      return;
    }
    $('#who-sheet').hidden = true;
    onKidChanged();
    toast(`Hi, ${store.current().name}!`);
  };
  updateWho();
  if (!store.current()) openWho();
}

// ---------- tabs, install, offline ----------

function route({ keepScroll = false } = {}) {
  applyUpdateIfSafe();
  let tab = (location.hash || '#solve').slice(1);
  // The back button (or a typed address) can't reach Solve during a round either.
  if ((tab === 'solve' || !['practice', 'progress'].includes(tab)) && roundActive()) {
    history.replaceState(null, '', '#practice');
    tab = 'practice';
    toast(LOCK_MESSAGE);
  }
  const valid = ['solve', 'practice', 'progress'].includes(tab) ? tab : 'solve';
  for (const v of ['solve', 'practice', 'progress']) $(`#view-${v}`).hidden = v !== valid;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === valid) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (valid === 'progress') renderProgress();
  if (valid !== 'progress' && !store.current() && $('#who-sheet').hidden && document.readyState !== 'loading' && whoReady) openWho();
  if (valid === 'practice' && !round) renderTopics();
  if (!keepScroll) window.scrollTo(0, 0);
}

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('#install').hidden = false;
});
$('#install').onclick = async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('#install').hidden = true;
};

// ---------- updates ----------
// A new version takes over in the background. Reload into it straight away, unless a
// practice round is going on: then wait until the round ends.
let updateWaiting = false;

function applyUpdateIfSafe() {
  if (!updateWaiting || (round && !round.done)) return;
  try { sessionStorage.setItem('math-buddy.updated', '1'); } catch { /* ignore */ }
  location.reload();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || updateWaiting) return; // first install, not an update
    updateWaiting = true;
    applyUpdateIfSafe();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* not available here; app still works online */ });
  });
  // An installed app often resumes from the background without reloading, so look for a
  // new version each time it comes back to the screen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {});
  });
}

try {
  if (sessionStorage.getItem('math-buddy.updated')) {
    sessionStorage.removeItem('math-buddy.updated');
    setTimeout(() => toast(`Updated to v${APP_VERSION}`), 600);
  }
} catch { /* ignore */ }

setupSolve();
setupPractice();
updateStars();
window.addEventListener('hashchange', () => route());
document.querySelector('.tabs').addEventListener('click', (e) => {
  if (e.target.closest('a[data-tab="solve"]') && roundActive()) {
    e.preventDefault();
    toast(LOCK_MESSAGE);
  }
});
route();
setupBackup();
setupWho();
checkCrown(); // remember who wears the crown now, so a change can be announced
// A device that already uses family sync reconnects by itself.
if (FIREBASE_CONFIG && store.syncInfo()) startSync();

// Open with a worked example so the first screen shows what the app does.
// Open with one of the examples worked out, so the first screen shows what the app does.
const firstExample = examples.find((e) => e.length < 32) || examples[0];
if (firstExample) {
  problemInput.value = firstExample;
  fitProblem();
  runSolve(firstExample, { remember: false });
}
